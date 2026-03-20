import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkouts } from '../hooks/useWorkouts';
import { hasTierAccess } from '../utils/tiers';
import { motion } from 'framer-motion';
import './workout-library.css';

const CATEGORY_LABELS = {
  all: 'All',
  general: 'General',
  home: 'Home',
  gym: 'Gym',
  outdoors: 'Outdoors',
  strength: 'Strength',
  cardio: 'Cardio',
  hiit: 'HIIT',
  mobility: 'Mobility',
  endurance: 'Endurance',
  scramble: 'Scramble',
};

export default function WorkoutLibrary() {
  const { getIdToken, userTier, isAdmin } = useAuth();
  const { workouts, loading, error } = useWorkouts(getIdToken);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let items = workouts;

    if (category !== 'all') {
      items = items.filter((w) => w.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (w) =>
          w.title?.toLowerCase().includes(q) ||
          w.description?.toLowerCase().includes(q) ||
          w.category?.toLowerCase().includes(q) ||
          w.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return items;
  }, [workouts, category, search]);

  // Get unique categories from data
  const availableCategories = useMemo(() => {
    const cats = new Set(workouts.map((w) => w.category));
    return ['all', ...Array.from(cats)];
  }, [workouts]);

  return (
    <div className="workout-library">
      <div className="workout-library-hero">
        <div className="wrap">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Workout Library
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Browse our collection of Hyrax training regimens. View the details
            or download a branded PDF to take to your session.
          </motion.p>
        </div>
      </div>

      <div className="wrap">
        {/* Filters */}
        <div className="workout-library-filters">
          <div className="workout-library-categories">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                className={`workout-cat-btn ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          <div className="workout-library-search">
            <input
              type="text"
              placeholder="Search workouts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="workout-library-loading">
            <div className="section-spinner" />
            <p>Loading workouts...</p>
          </div>
        ) : error ? (
          <div className="workout-library-error">
            <p>Unable to load workouts. Please try again later.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="workout-library-empty">
            <span className="workout-library-empty-icon">&#128170;</span>
            <h3>
              {search || category !== 'all'
                ? 'No matching workouts'
                : 'No workouts available yet'}
            </h3>
            <p>
              {search || category !== 'all'
                ? 'Try adjusting your filters or search.'
                : 'Check back soon for new training content!'}
            </p>
          </div>
        ) : (
          <motion.div
            className="workout-library-grid"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: { staggerChildren: 0.07 },
              },
            }}
          >
            {filtered.map((workout) => {
              const locked = !isAdmin && !hasTierAccess(userTier, workout.requiredTier);
              return (
                <motion.div
                  key={workout.id}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.35 }}
                >
                  <Link
                    to={`/portal/workouts/${workout.id}`}
                    className="workout-card-link"
                  >
                    <article className={`workout-card${locked ? ' locked' : ''}`}>
                      <div className={`workout-card-img${workout.imageUrl ? '' : ' placeholder'}`}>
                        {workout.imageUrl ? (
                          <img src={workout.imageUrl} alt={workout.title} />
                        ) : (
                          <span>&#128170;</span>
                        )}
                        {locked && (
                          <div className="workout-card-lock-overlay">
                            <span className="workout-card-lock-icon">&#128274;</span>
                          </div>
                        )}
                      </div>

                      <div className="workout-card-body">
                        <div className="workout-card-badges">
                          <span className="workout-card-badge category">
                            {workout.category}
                          </span>
                          {locked && (
                            <span className="workout-card-badge tier-required">
                              {workout.requiredTier}
                            </span>
                          )}
                        </div>

                        <h3>{workout.title}</h3>

                        {workout.description && (
                          <p>
                            {workout.description.slice(0, 100)}
                            {workout.description.length > 100 ? '...' : ''}
                          </p>
                        )}

                        <div className="workout-card-footer">
                          {workout.duration && (
                            <span className="workout-card-duration">
                              &#9201; {workout.duration}
                            </span>
                          )}
                          <span className="workout-card-exercises">
                            {workout.exercises?.length || 0} exercises
                          </span>
                        </div>
                        {workout.tags?.length > 0 && (
                          <div className="workout-card-tags">
                            {workout.tags.slice(0, 3).map((tag, ti) => (
                              <span key={ti} className="workout-card-tag">{tag}</span>
                            ))}
                            {workout.tags.length > 3 && (
                              <span className="workout-card-tag">+{workout.tags.length - 3}</span>
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
