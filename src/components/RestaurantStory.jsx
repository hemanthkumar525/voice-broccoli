import React from 'react';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiArrowUpRight, FiMapPin } = FiIcons;

function RestaurantStory() {
  return (
    <section className="story-section" id="story">
      <div className="story-photo">
        <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1300&q=85" alt="Broccoli Pizza & Pasta restaurant kitchen and dining" loading="lazy" />
        <div className="story-photo-label"><span>BORN IN DUBAI</span><strong>December 2011.</strong></div>
      </div>
      <div className="story-content">
        <span className="eyebrow"><span className="eyebrow-dot" /> OUR STORY</span>
        <h2>From a Dubai kitchen<br />to a <em>growing favourite.</em></h2>
        <p>The first Broccoli Pizza & Pasta opened on 2 December 2011 in TECOM (Barsha Heights), Dubai. From the start, our idea was simple: freshly prepared, Italian-inspired pizza and pasta prepared right in the restaurant, with room to make every meal your own.</p>
        <div className="story-actions">
          <Link className="button button-green" to="/about">Read our full story <SafeIcon icon={FiArrowUpRight} /></Link>
          <Link className="text-link story-link" to="/locations">Explore UAE locations <SafeIcon icon={FiArrowUpRight} /></Link>
        </div>
        <div className="story-location"><SafeIcon icon={FiMapPin} /><span><strong>Broccoli Pizza & Pasta UAE</strong><br />Serving DIFC, Barsha Heights, Al Twar 2, Abu Dhabi & across the Emirates. Ask Zara for details.</span></div>
      </div>
    </section>
  );
}

export default RestaurantStory;