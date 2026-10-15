import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiArrowUpRight, FiExternalLink, FiSparkles, FiCheck } = FiIcons;

const menuCategories = ['All', 'Pizza', 'Pasta', 'Salads', 'Sides'];

const menuDishes = [
  // Pizzas
  {
    id: 'p-1',
    name: 'Chicken BBQ Pizza',
    category: 'Pizza',
    description: 'Tender chicken breast, sweet smoky BBQ sauce, red onions, and melted golden mozzarella cheese.',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
    popular: true,
    tag: 'Signature Favourite'
  },
  {
    id: 'p-2',
    name: 'Deluxe Pizza',
    category: 'Pizza',
    description: 'Loaded with beef pepperoni, seasoned ground beef, green bell peppers, fresh mushrooms, black olives, and mozzarella.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    popular: true,
    tag: 'Chef Choice'
  },
  {
    id: 'p-3',
    name: 'Pepperoni Pizza',
    category: 'Pizza',
    description: 'Generous layers of premium beef pepperoni, rich Italian herb marinara, and melted mozzarella on crispy crust.',
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Classic'
  },
  {
    id: 'p-4',
    name: 'Greek Pizza',
    category: 'Pizza',
    description: 'Tangy feta cheese crumbles, sliced black olives, ripe cherry tomatoes, crisp red onions, and aromatic oregano.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Mediterranean'
  },
  {
    id: 'p-5',
    name: 'Vegetable Pizza',
    category: 'Pizza',
    description: 'Fresh broccoli florets, button mushrooms, crisp green bell peppers, diced onions, ripe tomatoes, and herbs.',
    image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Vegetarian'
  },
  {
    id: 'p-6',
    name: 'Classic Cheese Pizza',
    category: 'Pizza',
    description: 'Rich tomato sauce topped with 100% whole milk mozzarella melted to golden perfection.',
    image: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'All-time Classic'
  },

  // Pastas
  {
    id: 'pa-1',
    name: 'Chicken Pasta & Alfredo',
    category: 'Pasta',
    description: 'Grilled tender chicken breast, vibrant broccoli florets, penne, and rich homemade creamy Alfredo sauce.',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
    popular: true,
    tag: 'Customer Favourite'
  },
  {
    id: 'pa-2',
    name: 'Spaghetti Bolognese Pasta',
    category: 'Pasta',
    description: 'Traditional slow-cooked minced beef ragù simmered with Italian herbs, garlic, crushed tomatoes over spaghetti.',
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=800&q=80',
    popular: true,
    tag: 'Italian Classic'
  },
  {
    id: 'pa-3',
    name: 'Beef Strips Pasta',
    category: 'Pasta',
    description: 'Succulent sautéed beef strips, sliced mushrooms, garlic butter, and creamy savory sauce with penne.',
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Hearty'
  },
  {
    id: 'pa-4',
    name: 'Shrimp Pasta',
    category: 'Pasta',
    description: 'Pan-seared garlic shrimp tossed in delicate creamy pink Rosa sauce or garlic butter with fresh herbs.',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Seafood'
  },
  {
    id: 'pa-5',
    name: 'Meatballs Pasta',
    category: 'Pasta',
    description: 'Juicy seasoned meatballs simmered in rich tomato marinara sauce, garnished with parmesan cheese.',
    image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Comfort Food'
  },
  {
    id: 'pa-6',
    name: 'Fresh Vegetable Pasta',
    category: 'Pasta',
    description: 'Tender broccoli florets, mushrooms, sweet corn, zucchini, and marinara or pesto sauce.',
    image: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Vegetarian'
  },

  // Salads
  {
    id: 's-1',
    name: 'Chicken Caesar Salad',
    category: 'Salads',
    description: 'Crisp romaine lettuce, tender grilled chicken slices, shaved parmesan cheese, crunchy garlic croutons, house dressing.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    popular: true,
    tag: 'Top Salad'
  },
  {
    id: 's-2',
    name: 'Traditional Greek Salad',
    category: 'Salads',
    description: 'Fresh diced cucumbers, ripe tomatoes, red onions, Kalamata olives, creamy feta cheese block, extra virgin olive oil.',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Fresh'
  },
  {
    id: 's-3',
    name: 'Shrimps Salad',
    category: 'Salads',
    description: 'Succulent seasoned shrimps served over mixed crisp greens, cherry tomatoes, cucumbers, and zesty citrus dressing.',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Light & Crisp'
  },

  // Sides
  {
    id: 'sd-1',
    name: 'Cheesy Garlic Bread',
    category: 'Sides',
    description: 'Crispy artisan baguette slices brushed with fragrant garlic herb butter and covered in melted mozzarella.',
    image: 'https://images.unsplash.com/photo-1619895092538-128341789043?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Warm Side'
  },
  {
    id: 'sd-2',
    name: 'Golden Potato Wedges',
    category: 'Sides',
    description: 'Thick potato wedges roasted with Italian herbs and sea salt, served with tangy garlic dipping sauce.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    popular: false,
    tag: 'Crispy'
  }
];

function MenuPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredDishes =
    activeCategory === 'All'
      ? menuDishes
      : menuDishes.filter((dish) => dish.category === activeCategory);

  return (
    <div className="menu-page">
      <section className="page-hero">
        <span className="eyebrow">
          <span className="eyebrow-dot" /> DIFC & UAE MENU
        </span>
        <h1>Find your <em>craving.</em></h1>
        <p className="page-hero-subtitle">
          Explore selected pizza, pasta, and salad favourites cross-checked on Broccoli DIFC’s GoOrder and Talabat listings.
          Prepared fresh in our restaurant kitchens with room to make every meal your own.
        </p>

        <div className="order-partner-pills">
          <a
            className="button button-green"
            href="https://goorder.com/restaurant/68a46334be07d1a17f24f5ec/broccoli-pizza-pasta-difc"
            target="_blank"
            rel="noreferrer"
          >
            Order DIFC on GoOrder <SafeIcon icon={FiExternalLink} />
          </a>
          <a
            className="button button-lime"
            href="https://www.talabat.com/uae/restaurant/795126/broccoli-pizza-pasta?aid=1256"
            target="_blank"
            rel="noreferrer"
          >
            Order DIFC on Talabat <SafeIcon icon={FiExternalLink} />
          </a>
        </div>
      </section>

      <section className="category-tabs-section">
        <div className="category-tabs-nav" role="tablist">
          {menuCategories.map((category) => (
            <button
              key={category}
              role="tab"
              aria-selected={activeCategory === category}
              className={`category-tab-btn ${activeCategory === category ? 'is-active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="menu-catalog section-wrap">
        <div className="menu-grid">
          {filteredDishes.map((dish, index) => (
            <motion.article
              className="menu-item-card"
              key={dish.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="menu-item-image-wrap">
                <img src={dish.image} alt={dish.name} loading="lazy" />
                <span className="menu-item-tag">{dish.tag}</span>
              </div>
              <div className="menu-item-body">
                <span className="menu-item-category">{dish.category}</span>
                <h3>{dish.name}</h3>
                <p>{dish.description}</p>
                <div className="menu-item-meta">
                  <span className="menu-item-hint">
                    <SafeIcon icon={FiCheck} /> Freshly prepared
                  </span>
                  <a
                    className="menu-item-action"
                    href="https://goorder.com/restaurant/68a46334be07d1a17f24f5ec/broccoli-pizza-pasta-difc"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check Price ↗
                  </a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="custom-craft-card">
          <div className="custom-craft-badge">
            <SafeIcon icon={FiSparkles} /> CREATE YOUR OWN
          </div>
          <h2>Your taste. <em>Your choice.</em></h2>
          <p>
            The signature Broccoli way: customize your meal from scratch! Choose your pasta shape (penne, spaghetti, or fettuccine), pick your homemade sauce (Alfredo, Marinara, Pesto, Creamy Pink), and add your favourite fresh vegetables and tender proteins.
          </p>
          <div className="custom-craft-steps">
            <div className="custom-step">
              <strong>1. Base</strong>
              <span>Penne, Spaghetti, or Pizza Crust</span>
            </div>
            <div className="custom-step">
              <strong>2. Sauce</strong>
              <span>Alfredo, Marinara, Pink Rosa, or Pesto</span>
            </div>
            <div className="custom-step">
              <strong>3. Veggies</strong>
              <span>Fresh Broccoli, Mushrooms, Olives, Peppers</span>
            </div>
            <div className="custom-step">
              <strong>4. Protein</strong>
              <span>Grilled Chicken, Beef Strips, Shrimps, or Meatballs</span>
            </div>
          </div>
        </div>

        <div className="menu-disclaimer-note">
          <span>✳</span> Menu dishes shown reflect selected items on Broccoli DIFC’s GoOrder and Talabat listings. Partner menus also include quesadillas, appetizers, soups, and desserts. For current sizes, discounts, and availability, tap the DIFC ordering links above.
        </div>
      </section>
    </div>
  );
}

export default MenuPage;

