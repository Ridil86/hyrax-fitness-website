import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVideos } from '../../hooks/useVideos';
import { hasTierAccess } from '../../utils/tiers';
import { motion } from 'framer-motion';
import './video-library.css';

const CATEGORY_LABELS = {
  all: 'All Videos',
  'program-explainer': 'Program Explainers',
  'movement-tutorial': 'Movement Tutorials',
  'full-workout-routine': 'Full Workouts',
};

export default function VideoLibrary() {
  const { getIdToken, userTier, isAdmin } = useAuth();
  const { videos, loading, error } = useVideos(getIdToken);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let items = videos;

    if (category !== 'all') {
      items = items.filter((v) => v.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q) ||
          v.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return items;
  }, [videos, category, search]);

  // Get unique categories from data
  const availableCategories = useMemo(() => {
    const cats = new Set(videos.map((v) => v.category));
    return ['all', ...Array.from(cats)];
  }, [videos]);

  return (
    <div className="video-library">
      <div className="video-library-hero">
        <div className="wrap">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Video Library
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Program explainers, movement tutorials, and full workout routines
            to guide your training.
          </motion.p>
        </div>
      </div>

      <div className="wrap">
        {/* Filters */}
        <div className="video-library-filters">
          <div className="video-library-categories">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                className={`video-cat-btn ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          <div className="video-library-search">
            <input
              type="text"
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="video-library-loading">
            <div className="section-spinner" />
            <p>Loading videos...</p>
          </div>
        ) : error ? (
          <div className="video-library-error">
            <p>Unable to load videos. Please try again later.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="video-library-empty">
            <span className="video-library-empty-icon">&#9654;</span>
            <h3>
              {search || category !== 'all'
                ? 'No matching videos'
                : 'No videos available yet'}
            </h3>
            <p>
              {search || category !== 'all'
                ? 'Try adjusting your filters or search.'
                : 'Check back soon for new video content!'}
            </p>
          </div>
        ) : (
          <motion.div
            className="video-library-grid"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: { staggerChildren: 0.07 },
              },
            }}
          >
            {filtered.map((video) => {
              const locked = !isAdmin && !hasTierAccess(userTier, video.requiredTier);
              return (
                <motion.div
                  key={video.id}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.35 }}
                >
                  <Link
                    to={locked ? '/portal/subscription' : `/portal/videos/${video.id}`}
                    className="video-card-link"
                  >
                    <article className={`video-card${locked ? ' locked' : ''}`}>
                      <div className={`video-card-img${video.thumbnailUrl ? '' : ' placeholder'}`}>
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt={video.title} />
                        ) : (
                          <span className="video-card-play-icon">&#9654;</span>
                        )}
                        {locked && (
                          <div className="video-card-lock-overlay">
                            <span className="video-card-lock-icon">&#128274;</span>
                          </div>
                        )}
                        {!locked && (
                          <div className="video-card-play-overlay">
                            <span className="video-card-play-btn">&#9654;</span>
                          </div>
                        )}
                        {video.duration && (
                          <span className="video-card-duration">{video.duration}</span>
                        )}
                      </div>

                      <div className="video-card-body">
                        <div className="video-card-badges">
                          <span className="video-card-badge category">
                            {CATEGORY_LABELS[video.category] || video.category}
                          </span>
                          {locked && (
                            <span className="video-card-badge tier-required">
                              {video.requiredTier}
                            </span>
                          )}
                        </div>

                        <h3>{video.title}</h3>

                        {video.description && (
                          <p>
                            {video.description.slice(0, 100)}
                            {video.description.length > 100 ? '...' : ''}
                          </p>
                        )}

                        {video.tags?.length > 0 && (
                          <div className="video-card-tags">
                            {video.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="video-card-tag">{tag}</span>
                            ))}
                            {video.tags.length > 3 && (
                              <span className="video-card-tag">+{video.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
