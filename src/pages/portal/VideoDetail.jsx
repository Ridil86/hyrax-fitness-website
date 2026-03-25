import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Hls from 'hls.js';
import { useAuth } from '../../context/AuthContext';
import { fetchVideo, fetchVideos } from '../../api/videos';
import { fetchExercises } from '../../api/exercises';
import { fetchUserLogs } from '../../api/completionLog';
import CompletionForm from '../../components/CompletionForm';
import { hasTierAccess, getRequiredTierInfo } from '../../utils/tiers';
import { trackVideoStart, trackVideoProgress, trackVideoComplete } from '../../utils/analytics';
import './video-detail.css';

const CATEGORY_LABELS = {
  'program-explainer': 'Program Explainer',
  'movement-tutorial': 'Movement Tutorial',
  'full-workout-routine': 'Full Workout',
};

export default function VideoDetail() {
  const { id } = useParams();
  const { getIdToken, effectiveTier, isAdmin } = useAuth();
  const [video, setVideo] = useState(null);
  const [related, setRelated] = useState([]);
  const [exerciseData, setExerciseData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionCount, setCompletionCount] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getIdToken();
        const data = await fetchVideo(id, token);
        if (!cancelled) {
          setVideo(data);

          // Load exercise details if video has exercises
          if (data.exercises?.some(e => e.exerciseId)) {
            try {
              const allExercises = await fetchExercises(token);
              const map = {};
              allExercises.forEach(e => { map[e.id] = e; });
              if (!cancelled) setExerciseData(map);
            } catch { /* best effort */ }
          }

          // Load completion count for this video
          if (data.exercises?.length > 0 || data.workouts?.length > 0) {
            try {
              const logsData = await fetchUserLogs({}, token);
              const allLogs = Array.isArray(logsData) ? logsData : logsData?.logs || [];
              const count = allLogs.filter(
                (l) => l.source === 'video' && l.sourceId === data.id
              ).length;
              if (!cancelled) setCompletionCount(count);
            } catch { /* best effort */ }
          }

          // Load related videos (same category, exclude current)
          try {
            const all = await fetchVideos(token);
            const relatedItems = all
              .filter((v) => v.category === data.category && v.id !== data.id)
              .slice(0, 4);
            if (!cancelled) setRelated(relatedItems);
          } catch {
            // Related videos are best-effort
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load video');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, getIdToken]);

  // Video analytics tracking
  const progressMilestones = useRef(new Set());

  const handlePlay = useCallback(() => {
    if (video) {
      trackVideoStart(video.id, video.title, video.category);
    }
  }, [video]);

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration || !video) return;
    const pct = (el.currentTime / el.duration) * 100;
    [25, 50, 75].forEach((milestone) => {
      if (pct >= milestone && !progressMilestones.current.has(milestone)) {
        progressMilestones.current.add(milestone);
        trackVideoProgress(video.id, milestone);
      }
    });
  }, [video]);

  const handleEnded = useCallback(() => {
    const el = videoRef.current;
    if (video && el) {
      trackVideoComplete(video.id, el.currentTime, el.duration);
    }
  }, [video]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    progressMilestones.current = new Set();
    el.addEventListener('play', handlePlay);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);
    return () => {
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
    };
  }, [video, handlePlay, handleTimeUpdate, handleEnded]);

  // HLS.js adaptive streaming setup
  const locked = !isAdmin && !hasTierAccess(effectiveTier, video?.requiredTier);
  useEffect(() => {
    if (locked || !video) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const hlsUrl = video.hlsUrl;
    const fallbackUrl = video.videoUrl;

    // Prefer HLS if available
    if (hlsUrl && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && fallbackUrl) {
          console.warn('HLS error, falling back to original video');
          hls.destroy();
          videoEl.src = fallbackUrl;
        }
      });
      return () => hls.destroy();
    }

    // Safari native HLS
    if (hlsUrl && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = hlsUrl;
      return;
    }

    // Fallback to original MP4
    if (fallbackUrl) {
      videoEl.src = fallbackUrl;
    }
  }, [video, locked]);

  if (loading) {
    return (
      <div className="video-detail">
        <div className="wrap">
          <div className="video-detail-loading">
            <div className="section-spinner" />
            <p>Loading video...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="video-detail">
        <div className="wrap">
          <div className="video-detail-error">
            <h2>Video Not Found</h2>
            <p>{error || 'This video may have been removed or is not yet published.'}</p>
            <Link to="/portal/videos" className="btn primary">
              Back to Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const requiredInfo = locked ? getRequiredTierInfo(video.requiredTier) : null;

  return (
    <div className="video-detail">
      {/* Hero */}
      <div
        className="video-detail-hero"
        style={
          video.thumbnailUrl
            ? { backgroundImage: `linear-gradient(rgba(27,18,10,.65), rgba(27,18,10,.85)), url(${video.thumbnailUrl})` }
            : undefined
        }
      >
        <div className="wrap">
          <Link to="/portal/videos" className="video-detail-back">
            &#8592; Back to Library
          </Link>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {video.title}
          </motion.h1>

          <motion.div
            className="video-detail-hero-meta"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <span className="video-detail-badge">
              {CATEGORY_LABELS[video.category] || video.category}
            </span>
            {video.duration && (
              <span className="video-detail-badge">&#9201; {video.duration}</span>
            )}
            <span className="video-detail-badge">{video.requiredTier}</span>
          </motion.div>
        </div>
      </div>

      <div className="wrap">
        {locked ? (
          <motion.div
            className="video-detail-locked"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="video-locked-card">
              <span className="video-locked-icon">&#128274;</span>
              <h2>Premium Content</h2>
              <p>
                This video requires the{' '}
                <strong>{requiredInfo.label}</strong> tier ({requiredInfo.price})
                or higher to access.
              </p>
              <p className="video-locked-sub">
                Upgrade your plan to unlock this video and all premium content.
              </p>
              <div className="video-locked-actions">
                <Link to="/portal/subscription" className="btn primary">
                  Upgrade Plan
                </Link>
                <Link to="/portal/videos" className="btn ghost">
                  Back to Library
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="video-detail-content">
            {/* Transcoding status banner */}
            {video.transcodingStatus === 'processing' && (
              <div className="video-transcoding-banner">
                <div className="section-spinner" style={{ width: 16, height: 16 }} />
                <span>Video is being optimized for streaming. Playing original quality.</span>
              </div>
            )}
            {video.transcodingStatus === 'error' && (
              <div className="video-transcoding-error">
                Streaming optimization failed. Playing original quality.
              </div>
            )}

            {/* Video Player */}
            <motion.div
              className="video-player-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              {video.videoUrl || video.hlsUrl ? (
                <video
                  ref={videoRef}
                  className="video-player"
                  poster={video.thumbnailUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="video-player-placeholder">
                  <span>&#9654;</span>
                  <p>Video not yet available</p>
                </div>
              )}
            </motion.div>

            {/* Info */}
            <motion.div
              className="video-detail-info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {video.description && (
                <p className="video-detail-desc">{video.description}</p>
              )}

              {video.tags?.length > 0 && (
                <div className="video-detail-tags">
                  {video.tags.map((tag, i) => (
                    <span key={i} className="video-detail-tag">{tag}</span>
                  ))}
                </div>
              )}

              <div className="video-detail-stats">
                <div>
                  <span className="video-qs-label">Category</span>
                  <span className="video-qs-value">
                    {CATEGORY_LABELS[video.category] || video.category}
                  </span>
                </div>
                {video.duration && (
                  <div>
                    <span className="video-qs-label">Duration</span>
                    <span className="video-qs-value">{video.duration}</span>
                  </div>
                )}
                <div>
                  <span className="video-qs-label">Access Tier</span>
                  <span className="video-qs-value">{video.requiredTier}</span>
                </div>
              </div>
            </motion.div>

            {/* Linked Exercises */}
            {video.exercises?.length > 0 && (
              <section className="video-detail-linked">
                <h2>Exercises in this Video</h2>
                <div className="video-linked-exercises">
                  {video.exercises.map((ex, i) => {
                    const full = exerciseData[ex.exerciseId];
                    const mod = full?.modifications?.[ex.difficulty];
                    return (
                      <div key={i} className="video-linked-exercise-card">
                        {(mod?.imageUrl || full?.imageUrl) && (
                          <img src={mod?.imageUrl || full?.imageUrl} alt={ex.exerciseName} className="video-linked-exercise-img" />
                        )}
                        <div className="video-linked-exercise-info">
                          <h3>{ex.exerciseName}</h3>
                          {mod?.subName && <p className="video-linked-mod-name">{mod.subName}</p>}
                          <span className="video-linked-diff-badge">{ex.difficulty}</span>
                          {mod?.description && <p className="video-linked-mod-desc">{mod.description}</p>}
                          {mod?.equipment?.length > 0 && (
                            <div className="video-linked-equipment">
                              {mod.equipment.map(eq => (
                                <span key={eq.equipmentId} className="video-linked-equip-tag">{eq.equipmentName}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Linked Workouts */}
            {video.workouts?.length > 0 && (
              <section className="video-detail-linked">
                <h2>Workouts in this Video</h2>
                <div className="video-linked-workouts">
                  {video.workouts.map((wk, i) => (
                    <Link key={i} to={`/portal/workouts/${wk.workoutId}`} className="video-linked-workout-card">
                      <div className="video-linked-workout-info">
                        <h3>{wk.workoutTitle}</h3>
                        <span className="video-linked-diff-badge">{wk.difficulty}</span>
                      </div>
                      <span className="video-linked-workout-arrow">&rarr;</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Completion Logging */}
            {(video.exercises?.length > 0 || video.workouts?.length > 0) && (
              <section className="video-detail-linked">
                <div className="video-completion-card">
                  <div className="video-completion-header">
                    <h2>Log Completion</h2>
                    {completionCount > 0 && (
                      <span className="video-completion-count">{completionCount}</span>
                    )}
                  </div>
                  <p className="video-completion-desc">
                    Track your progress by logging a completion for the exercises in this video.
                  </p>
                  <button
                    className="btn primary"
                    onClick={() => setShowCompletionForm(true)}
                  >
                    Log Completion
                  </button>
                </div>
                {showCompletionForm && (
                  <CompletionForm
                    exercises={
                      video.exercises?.map((ex) => ({
                        exerciseId: ex.exerciseId,
                        exerciseName: ex.exerciseName,
                        sets: 1,
                        reps: 0,
                        difficulty: ex.difficulty,
                      })) || []
                    }
                    source="video"
                    sourceId={video.id}
                    onClose={() => setShowCompletionForm(false)}
                    onComplete={() => {
                      setShowCompletionForm(false);
                      setCompletionCount((c) => c + 1);
                    }}
                  />
                )}
              </section>
            )}

            {/* Related Videos */}
            {related.length > 0 && (
              <motion.div
                className="video-detail-related"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <h3>Related Videos</h3>
                <div className="video-related-grid">
                  {related.map((rv) => {
                    const rvLocked = !isAdmin && !hasTierAccess(effectiveTier, rv.requiredTier);
                    return (
                      <Link
                        key={rv.id}
                        to={rvLocked ? '/portal/subscription' : `/portal/videos/${rv.id}`}
                        className="video-related-card"
                      >
                        <div className={`video-related-thumb${rv.thumbnailUrl ? '' : ' placeholder'}`}>
                          {rv.thumbnailUrl ? (
                            <img src={rv.thumbnailUrl} alt={rv.title} />
                          ) : (
                            <span>&#9654;</span>
                          )}
                          {rv.duration && (
                            <span className="video-related-duration">{rv.duration}</span>
                          )}
                          {rvLocked && (
                            <div className="video-related-lock">&#128274;</div>
                          )}
                        </div>
                        <div className="video-related-info">
                          <h4>{rv.title}</h4>
                          <span className="video-related-cat">
                            {CATEGORY_LABELS[rv.category] || rv.category}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
