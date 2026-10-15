import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiArrowUpRight, FiClock, FiHeart, FiAward } = FiIcons;

const milestones = [
  {
    year: '2011',
    title: 'The First Broccoli Opens',
    description: 'Broccoli Pizza & Pasta opens its very first restaurant doors in TECOM (Barsha Heights), Dubai, on 2 December 2011.'
  },
  {
    year: '2012',
    title: 'A Second Dubai Restaurant',
    description: 'Following rapid popularity, a second Dubai restaurant opens in Jumeirah to welcome more pizza & pasta enthusiasts.'
  },
  {
    year: '2015',
    title: 'Across the Border',
    description: 'Broccoli’s proven concept and fresh kitchen model expand regionally into the Kingdom of Saudi Arabia.'
  },
  {
    year: '2016',
    title: 'An International Step',
    description: 'The company takes an exciting global step by opening its first international restaurant in the United Kingdom.'
  },
  {
    year: '2017',
    title: 'Regional Franchise Growth',
    description: 'The expansion momentum continues with Broccoli’s first franchise restaurant opening in the Sultanate of Oman.'
  },
  {
    year: 'Today',
    title: 'Serving the UAE Everyday',
    description: 'Over 20 listings across Dubai, Abu Dhabi, Sharjah, and the Northern Emirates—bringing fresh feel-good food to everyone.'
  }
];

function AboutPage() {
  return (
    <div className="about-page">
      <section className="page-hero">
        <span className="eyebrow">
          <span className="eyebrow-dot" /> DUBAI SINCE 2011
        </span>
        <h1>From a Dubai kitchen<br />to a <em>growing favourite.</em></h1>
        <p className="page-hero-subtitle">
          The first Broccoli Pizza & Pasta restaurant opened on 2 December 2011 in TECOM, Dubai. From the start, the idea was simple: freshly prepared pizza and pasta, with room to make every meal your own.
        </p>
      </section>

      <section className="about-story-grid section-wrap">
        <div className="story-split-row">
          <div className="story-split-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> OUR PHILOSOPHY</span>
            <h2>Prepared in-store.<br /><em>Never a factory kitchen.</em></h2>
            <p>
              The original Broccoli concept centred on Italian-inspired favourites prepared in the restaurant, rather than an anonymous central production facility. Every pizza is tossed and baked in our ovens, and every pasta is freshly sautéed when you order.
            </p>
            <p>
              A menu built around choice, fresh ingredients, and the simple pleasure of a wholesome meal has defined our culinary philosophy since the beginning.
            </p>
            <div className="philosophy-badges">
              <div className="philosophy-pill">
                <SafeIcon icon={FiHeart} /> Made Fresh Daily
              </div>
              <div className="philosophy-pill">
                <SafeIcon icon={FiAward} /> Italian-Inspired
              </div>
              <div className="philosophy-pill">
                <SafeIcon icon={FiClock} /> Made In Minutes
              </div>
            </div>
          </div>
          <div className="story-split-visual">
            <img
              src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85"
              alt="Broccoli Pizza & Pasta restaurant kitchen"
              className="story-visual-img"
            />
            <div className="story-visual-badge">
              <strong>Est. 2 Dec 2011</strong>
              <span>TECOM, Dubai</span>
            </div>
          </div>
        </div>
      </section>

      <section className="timeline-section section-wrap">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" /> HISTORICAL MILESTONES</span>
            <h2>A brief look <em>back.</em></h2>
          </div>
          <p>Key moments that shaped the journey of Broccoli Pizza & Pasta from Dubai to the world.</p>
        </div>

        <div className="timeline-grid">
          {milestones.map((m, idx) => (
            <motion.div
              className="timeline-card"
              key={m.year}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
            >
              <span className="timeline-year">{m.year}</span>
              <h3>{m.title}</h3>
              <p>{m.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="closing-cta">
        <div className="closing-inner">
          <span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> BE PART OF THE STORY</span>
          <h2>Taste the difference.<br /><em>Made fresh for you.</em></h2>
          <p>
            Explore our create-your-own pizza and pasta menu, or learn more about franchise opportunities across the region.
          </p>
          <div className="closing-actions">
            <Link className="button button-lime" to="/menu">
              Explore Our Menu <SafeIcon icon={FiArrowUpRight} />
            </Link>
            <Link className="text-link text-link-light" to="/franchise">
              Franchise Opportunities <SafeIcon icon={FiArrowUpRight} />
            </Link>
          </div>
          <div className="closing-stamp">DUBAI<br />SINCE <span>♥</span><br />2011</div>
        </div>
      </section>
    </div>
  );
}

export default AboutPage;

