import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiArrowUpRight } = FiIcons;

const dishes = [
  {
    name: 'Pepperoni, BBQ & Deluxe Pizzas',
    category: 'PIZZA FAVOURITES',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=85',
    alt: 'Freshly baked Italian pizza with rich cheese and toppings',
    tone: 'dish-lime',
    link: '/menu#pizza'
  },
  {
    name: 'Chicken, Bolognese & Meatball Pastas',
    category: 'PASTA CHOICES',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=85',
    alt: 'Fresh pasta with homemade sauces and vegetables',
    tone: 'dish-peach',
    link: '/menu#pasta'
  },
  {
    name: 'Greek, Caesar & Fresh Garden Salads',
    category: 'FRESH SALADS',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85',
    alt: 'Fresh crisp garden salad with mixed vegetables and dressing',
    tone: 'dish-sage',
    link: '/menu#salads'
  }
];

function MenuHighlights() {
  return (
    <section className="menu-section section-wrap" id="menu">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> WHAT ARE YOU CRAVING?</span>
          <h2>Pizza. Pasta. <em>Your way.</em></h2>
        </div>
        <p>Pasta, sauce, and your favourite finishing touches. Find inspiration in Broccoli’s create-your-own favourites.</p>
      </div>
      <div className="dish-grid">
        {dishes.map((dish, index) => (
          <motion.article
            className={`dish-card ${dish.tone}`}
            key={dish.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <Link to="/menu" className="dish-card-link" aria-label={`View ${dish.name} on menu`}>
              <div className="dish-image-wrap">
                <img src={dish.image} alt={dish.alt} loading="lazy" />
                <span className="dish-arrow"><SafeIcon icon={FiArrowUpRight} /></span>
              </div>
              <div className="dish-copy">
                <span>{dish.category}</span>
                <h3>{dish.name}</h3>
              </div>
            </Link>
          </motion.article>
        ))}
      </div>
      <div className="menu-footer-cta">
        <Link to="/menu" className="button button-green">
          View full DIFC & UAE menu <SafeIcon icon={FiArrowUpRight} />
        </Link>
      </div>
      <div className="menu-note">
        <span>✳</span> DIFC & UAE menu favourites shown for inspiration. Ask Zara for current menu details, prices and branch availability.
      </div>
    </section>
  );
}

export default MenuHighlights;