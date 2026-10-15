import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiArrowUpRight, FiMenu, FiX } = FiIcons;

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  return (
    <header className="site-header">
      <Link className="brand" to="/" onClick={closeMenu} aria-label="Broccoli Pizza & Pasta home">
        <img src="/broccoli-logo.webp" alt="Broccoli Pizza & Pasta" className="brand-logo" />
      </Link>

      <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
          Home
        </NavLink>
        <NavLink to="/menu" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
          Our Menu
        </NavLink>
        <NavLink to="/locations" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
          Locations
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
          Our Story
        </NavLink>
        <NavLink to="/franchise" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
          Franchise
        </NavLink>
        <NavLink to="/contact" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
          Contact
        </NavLink>
      </nav>

      <div className="header-actions">
        <Link className="header-order" to="/menu" onClick={closeMenu}>
          <span>DIFC Menu</span> <SafeIcon icon={FiArrowUpRight} />
        </Link>
        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
        >
          <SafeIcon icon={mobileOpen ? FiX : FiMenu} />
        </button>
      </div>
    </header>
  );
}

export default Header;

