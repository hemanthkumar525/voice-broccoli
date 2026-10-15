import React from 'react';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiInstagram, FiFacebook, FiYoutube, FiExternalLink } = FiIcons;

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand-col">
          <Link className="brand footer-brand" to="/" aria-label="Broccoli Pizza & Pasta home">
            <img src="/broccoli-logo.webp" alt="Broccoli Pizza & Pasta" className="brand-logo footer-logo" />
          </Link>
          <p className="footer-desc">
            Freshly prepared pizza, pasta and salads across Dubai & the UAE since 2011. Your taste. Your choice.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <div className="footer-nav-col">
            <span className="footer-nav-title">Explore</span>
            <Link to="/">Home</Link>
            <Link to="/menu">DIFC Menu</Link>
            <Link to="/locations">UAE Locations</Link>
          </div>
          <div className="footer-nav-col">
            <span className="footer-nav-title">Company</span>
            <Link to="/about">Our Story</Link>
            <Link to="/franchise">Franchise</Link>
            <Link to="/contact">Contact & Feedback</Link>
          </div>
          <div className="footer-nav-col">
            <span className="footer-nav-title">Online Orders</span>
            <a href="https://goorder.com/brands/68a4629ebe07d1a17f24f44e" target="_blank" rel="noreferrer">
              GoOrder UAE <SafeIcon icon={FiExternalLink} />
            </a>
            <a href="https://www.talabat.com/uae/restaurant/795126/broccoli-pizza-pasta?aid=1256" target="_blank" rel="noreferrer">
              Talabat DIFC <SafeIcon icon={FiExternalLink} />
            </a>
          </div>
        </nav>
      </div>

      <div className="footer-bottom">
        <span className="copyright">© {new Date().getFullYear()} Broccoli Pizza & Pasta UAE. All rights reserved.</span>
        <div className="footer-socials">
          <a
            className="social-link"
            href="https://www.instagram.com/broccolipizzaandpasta/"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
          >
            <SafeIcon icon={FiInstagram} />
          </a>
          <a
            className="social-link"
            href="https://www.facebook.com/Broccolipizzaandpasta"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
          >
            <SafeIcon icon={FiFacebook} />
          </a>
          <a
            className="social-link"
            href="https://www.youtube.com/@broccolipizzapasta7120"
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube"
          >
            <SafeIcon icon={FiYoutube} />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

