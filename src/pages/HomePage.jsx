import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import MenuHighlights from '../components/MenuHighlights';
import RestaurantStory from '../components/RestaurantStory';

const { FiArrowDown, FiArrowUpRight } = FiIcons;

function HomePage() {
  return (
    <div className="home-page">
      <section className="hero" id="home">
        <div className="hero-copy">
          <motion.span className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="eyebrow-dot" /> FRESH PIZZA & PASTA IN DUBAI
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            Pizza. Pasta. <span>Your way.</span>
          </motion.h1>
          <p className="hero-description">
            For pizza people. Pasta people. And everyone hungry for both. Freshly prepared in our restaurant kitchens since 2011—ask Zara about our menu, prices and UAE locations.
          </p>
          <div className="hero-actions">
            <Link className="button button-green" to="/menu">
              Explore the menu <SafeIcon icon={FiArrowUpRight} />
            </Link>
            <Link className="text-link" to="/about">
              Our Dubai story <SafeIcon icon={FiArrowDown} />
            </Link>
          </div>
          <div className="hero-footnote">
            <span className="tiny-spark">✳</span> Prepared fresh in-store. Made for sharing.
          </div>
        </div>
        <div className="hero-visual">
          <img
            className="hero-image"
            src="https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1400&q=88"
            alt="Freshly prepared Italian pizza at Broccoli Pizza and Pasta"
          />
          <div className="hero-image-shade" />
          <div className="hero-image-caption">
            <span className="caption-mark">✳</span>
            <span>Fresh from<br />our kitchen</span>
          </div>
          <div className="hero-image-note">Your taste, your choice <span>↗</span></div>
        </div>
        <div className="hero-side-note">DUBAI & UAE <span>— EST. 2011</span></div>
      </section>

      <div className="marquee-strip" aria-label="Fresh ingredients, prepared in-store, your taste your choice">
        <span>FRESH INGREDIENTS</span><i>✳</i><span>PREPARED IN-STORE</span><i>✳</i><span>PIZZA & PASTA YOUR WAY</span><i>✳</i><span>DUBAI SINCE 2011</span><i>✳</i>
      </div>

      <MenuHighlights />
      <RestaurantStory />

      <section className="closing-cta" id="visit">
        <div className="closing-inner">
          <span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> FIND YOUR BROCCOLI MOMENT</span>
          <h2>Your taste.<br /><em>Your choice.</em></h2>
          <p>
            Find us in DIFC, Barsha Heights (TECOM), Abu Dhabi, or order through GoOrder and Talabat. Ask Zara about our dishes, prices, and locations.
          </p>
          <div className="closing-actions">
            <Link className="button button-lime" to="/locations">
              Find UAE locations <SafeIcon icon={FiArrowUpRight} />
            </Link>
            <Link className="text-link text-link-light" to="/menu">
              Explore full menu <SafeIcon icon={FiArrowUpRight} />
            </Link>
          </div>
          <div className="closing-stamp">DUBAI<br />SINCE <span>♥</span><br />2011</div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
