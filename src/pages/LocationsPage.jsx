import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiMapPin, FiExternalLink, FiNavigation } = FiIcons;

const emirates = ['All Emirates', 'Dubai', 'Abu Dhabi', 'Northern Emirates'];

const locationItems = [
  // Dubai
  {
    name: 'DIFC',
    region: 'Dubai',
    area: 'Dubai International Financial Centre',
    description: 'Serving DIFC financial district and Downtown Dubai with dine-in, takeaway, and fast office delivery.',
    goOrderUrl: 'https://goorder.com/restaurant/68a46334be07d1a17f24f5ec/broccoli-pizza-pasta-difc',
    talabatUrl: 'https://www.talabat.com/uae/restaurant/795126/broccoli-pizza-pasta?aid=1256',
    featured: true
  },
  {
    name: 'Barsha Heights (TECOM)',
    region: 'Dubai',
    area: 'TECOM / Barsha Heights',
    description: 'The historic first Broccoli restaurant where it all began on 2 December 2011! Fresh pizza & pasta made in-store.',
    goOrderUrl: 'https://goorder.com/restaurant/6abb60bad46e0501b03a173a',
    featured: true
  },
  {
    name: 'Al Twar 2',
    region: 'Dubai',
    area: 'Al Twar 2 & Deira Area',
    description: 'Serving Al Twar, Al Qusais, and surrounding neighborhoods with fresh oven-baked pizzas and custom pasta.',
    goOrderUrl: 'https://goorder.com/restaurant/6a666da1612e164c75b52985',
    featured: false
  },
  {
    name: 'Dubai Sports City',
    region: 'Dubai',
    area: 'Canal Residence & Sports City',
    description: 'Convenient neighborhood dining and home delivery for Dubai Sports City and Motor City residents.',
    goOrderUrl: 'https://goorder.com/restaurant/6abe2b19423a89b13fc47db4',
    featured: false
  },

  // Abu Dhabi
  {
    name: 'Khalidiyah',
    region: 'Abu Dhabi',
    area: 'Al Khalidiyah, Abu Dhabi',
    description: 'Centrally located in the heart of Abu Dhabi island, serving fresh Italian favourites daily.',
    goOrderUrl: 'https://goorder.com/restaurant/6abb6fcc8abee6fcdeae3eb6',
    featured: false
  },
  {
    name: 'Khalifa City B',
    region: 'Abu Dhabi',
    area: 'Shakhbout / Khalifa City',
    description: 'Serving the growing residential communities of Khalifa City B with fast takeaway and delivery.',
    goOrderUrl: 'https://goorder.com/restaurant/69ef0cc6835cb3141b815d99',
    featured: false
  },
  {
    name: 'Al Shamkha',
    region: 'Abu Dhabi',
    area: 'Al Shamkha Community, Abu Dhabi',
    description: 'Fresh pizza and pasta delivered hot and fresh across the Al Shamkha area.',
    goOrderUrl: 'https://goorder.com/restaurant/6ac7ec952c747691f2f9e8cf',
    featured: false
  },
  {
    name: 'Al Ain',
    region: 'Abu Dhabi',
    area: 'Al Ain Oasis Region',
    description: 'Serving families and students across the historic Garden City of Al Ain.',
    goOrderUrl: 'https://goorder.com/restaurant/6abe2b758327dbf0d733dc8e',
    featured: false
  },

  // Northern Emirates
  {
    name: 'Sharjah',
    region: 'Northern Emirates',
    area: 'Sharjah City',
    description: 'Serving the cultural capital of the UAE with authentic freshly made Italian pizza, pasta, and salads.',
    goOrderUrl: 'https://goorder.com/restaurant/6abe25157e7c12b1f6e9897a',
    featured: false
  },
  {
    name: 'Fujairah',
    region: 'Northern Emirates',
    area: 'Fujairah East Coast',
    description: 'Bringing fresh Italian food and create-your-own pasta to the East Coast of the UAE.',
    goOrderUrl: 'https://goorder.com/restaurant/6ac80bd3c893a5daf7c613a1',
    featured: false
  },
  {
    name: 'Ras Al Khaimah',
    region: 'Northern Emirates',
    area: 'RAK Community',
    description: 'Freshly prepared oven pizzas and made-to-order pastas for Ras Al Khaimah residents.',
    goOrderUrl: 'https://goorder.com/restaurant/6ac80cf7beb1aa813634b911',
    featured: false
  },
  {
    name: 'Umm Al Quwain',
    region: 'Northern Emirates',
    area: 'Umm Al Quwain City',
    description: 'Convenient takeaway and online ordering across the Umm Al Quwain community.',
    goOrderUrl: 'https://goorder.com/restaurant/6ac80d67eb6df307d127bcb9',
    featured: false
  }
];

function LocationsPage() {
  const [selectedRegion, setSelectedRegion] = useState('All Emirates');

  const filteredLocations =
    selectedRegion === 'All Emirates'
      ? locationItems
      : locationItems.filter((loc) => loc.region === selectedRegion);

  return (
    <div className="locations-page">
      <section className="page-hero">
        <span className="eyebrow">
          <span className="eyebrow-dot" /> ACROSS THE EMIRATES
        </span>
        <h1>Find a <em>Broccoli.</em></h1>
        <p className="page-hero-subtitle">
          Explore UAE Broccoli Pizza & Pasta locations across Dubai, Abu Dhabi, Sharjah, and the Northern Emirates.
          Check service options or order directly through GoOrder and Talabat.
        </p>

        <div className="directory-banner-pill">
          <span>Official GoOrder Directory</span>
          <a
            href="https://goorder.com/brands/68a4629ebe07d1a17f24f44e"
            target="_blank"
            rel="noreferrer"
            className="directory-link"
          >
            Browse all 21 UAE listings on GoOrder <SafeIcon icon={FiExternalLink} />
          </a>
        </div>
      </section>

      <section className="category-tabs-section">
        <div className="category-tabs-nav" role="tablist">
          {emirates.map((emirate) => (
            <button
              key={emirate}
              role="tab"
              aria-selected={selectedRegion === emirate}
              className={`category-tab-btn ${selectedRegion === emirate ? 'is-active' : ''}`}
              onClick={() => setSelectedRegion(emirate)}
            >
              {emirate}
            </button>
          ))}
        </div>
      </section>

      <section className="locations-catalog section-wrap">
        <div className="locations-grid">
          {filteredLocations.map((loc, idx) => (
            <motion.div
              className={`location-card ${loc.featured ? 'is-featured' : ''}`}
              key={loc.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="location-card-header">
                <span className="location-region-badge">{loc.region}</span>
                {loc.featured && <span className="location-flag">Featured Branch</span>}
              </div>
              <h3>{loc.name}</h3>
              <p className="location-area">
                <SafeIcon icon={FiMapPin} /> {loc.area}
              </p>
              <p className="location-desc">{loc.description}</p>

              <div className="location-links">
                {loc.goOrderUrl && (
                  <a
                    className="location-btn location-btn-goorder"
                    href={loc.goOrderUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GoOrder Listing <SafeIcon icon={FiExternalLink} />
                  </a>
                )}
                {loc.talabatUrl && (
                  <a
                    className="location-btn location-btn-talabat"
                    href={loc.talabatUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Talabat <SafeIcon icon={FiExternalLink} />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="location-note-card">
          <div className="location-note-header">
            <SafeIcon icon={FiNavigation} />
            <h4>Visiting a Broccoli restaurant?</h4>
          </div>
          <p>
            These area links come from GoOrder’s Broccoli Pizza & Pasta directory. Listed locations and operating hours are managed by ordering providers and may change. Please check provider listings or ask Zara before travelling.
          </p>
        </div>
      </section>
    </div>
  );
}

export default LocationsPage;
