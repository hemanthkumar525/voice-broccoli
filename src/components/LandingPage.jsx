import React from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import MenuHighlights from './MenuHighlights';
import RestaurantStory from './RestaurantStory';

const { FiArrowDown, FiArrowUpRight, FiInstagram } = FiIcons;

function LandingPage() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Broccoli Pizza & Pasta home">
          <img src="/broccoli-logo.webp" alt="Broccoli Pizza & Pasta" className="brand-logo" />
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#menu">Our menu</a>
          <a href="#story">Our story</a>
          <a href="#visit">UAE locations</a>
        </nav>
        <a className="header-order" href="#menu">Explore the menu <SafeIcon icon={FiArrowUpRight} /></a>
      </header>

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
            <a className="button button-green" href="#menu">Explore the menu <SafeIcon icon={FiArrowUpRight} /></a>
            <a className="text-link" href="#story">Our Dubai story <SafeIcon icon={FiArrowDown} /></a>
          </div>
          <div className="hero-footnote"><span className="tiny-spark">✳</span> Prepared fresh in-store. Made for sharing.</div>
        </div>
        <div className="hero-visual">
          <img className="hero-image" src="https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1400&q=88" alt="Freshly prepared Italian pizza at Broccoli Pizza and Pasta" />
          <div className="hero-image-shade" />
          <div className="hero-image-caption"><span className="caption-mark">✳</span><span>Fresh from<br />our kitchen</span></div>
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
          <p>Find us in DIFC, Barsha Heights (TECOM), Abu Dhabi, or order through GoOrder and Talabat. Ask Zara about our dishes, prices, and locations.</p>
          <a className="button button-lime" href="#menu">Find your favourite <SafeIcon icon={FiArrowUpRight} /></a>
          <div className="closing-stamp">DUBAI<br />SINCE <span>♥</span><br />2011</div>
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home" aria-label="Broccoli Pizza & Pasta home">
          <img src="/broccoli-logo.webp" alt="Broccoli Pizza & Pasta" className="brand-logo footer-logo" />
        </a>
        <p>Freshly prepared pizza, pasta and salads across Dubai & the UAE since 2011.</p>
        <a className="social-link" href="https://www.instagram.com/broccolipizzaandpasta/" target="_blank" rel="noreferrer" aria-label="Broccoli Pizza & Pasta Instagram"><SafeIcon icon={FiInstagram} /></a>
        <span className="copyright">© Broccoli Pizza & Pasta UAE</span>
      </footer>
    </main>
  );
}

export default LandingPage;