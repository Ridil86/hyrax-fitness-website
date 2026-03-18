import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Hls from 'hls.js';
import { useAuth } from '../../context/AuthContext';
import { fetchVideo, fetchVideos } from '../../api/videos';
import { hasTierAccess, getRequiredTierInfo } from '../../utils/tiers';
import './video-detail.css';

const CATEGORY_LABELS = {
  'program-explainer': 'Program Explainer',
  'movement-tutorial': 'Movement Tutorial',
  'full-workout-routine': 'Full Workout',
};

export default function VideoDetail() {
  const { id } = useParams();
  const { getIdToken, userTier, isAdmin } = useAuth();
  const [video, setVideo] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // HLS.js adaptive streaming setup
  const locked = !isAdmin && !hasTierAccess(userTier, video?.requiredTier);
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
                    const rvLocked = !isAdmin && !hasTierAccess(userTier, rv.requiredTier);
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
