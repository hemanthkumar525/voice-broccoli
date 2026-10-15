import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiCheckCircle, FiSend, FiMail, FiMapPin, FiMessageSquare, FiInstagram, FiFacebook, FiYoutube, FiExternalLink } = FiIcons;

function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'General Feedback',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="contact-page">
      <section className="page-hero">
        <span className="eyebrow">
          <span className="eyebrow-dot" /> CUSTOMER CARE & FEEDBACK
        </span>
        <h1>Say <em>hello.</em></h1>
        <p className="page-hero-subtitle">
          Questions, feedback, or something to share? Reach out to the Broccoli Pizza & Pasta team.
          We’d love to hear from our guests across Dubai and the UAE.
        </p>
      </section>

      <section className="contact-layout section-wrap">
        <div className="contact-grid">
          <div className="contact-info-col">
            <span className="eyebrow"><span className="eyebrow-dot" /> REACH OUT</span>
            <h2>We’re always here to <em>listen.</em></h2>
            <p>
              Whether you’re curious about our ingredients, want to share thoughts on your recent visit, or need assistance, we’re happy to help.
            </p>

            <div className="contact-methods">
              <div className="contact-method-card">
                <div className="method-icon"><SafeIcon icon={FiMapPin} /></div>
                <div>
                  <strong>UAE Headquarters & Founding Store</strong>
                  <p>Barsha Heights (TECOM), Dubai, United Arab Emirates</p>
                </div>
              </div>

              <div className="contact-method-card">
                <div className="method-icon"><SafeIcon icon={FiMail} /></div>
                <div>
                  <strong>Guest Enquiries & Support</strong>
                  <p>Submit a note using the enquiry form or speak with Zara.</p>
                </div>
              </div>

              <div className="contact-method-card">
                <div className="method-icon"><SafeIcon icon={FiMessageSquare} /></div>
                <div>
                  <strong>Order Support (Talabat & GoOrder)</strong>
                  <p>For live order status, please check directly through your Talabat or GoOrder app account.</p>
                </div>
              </div>
            </div>

            <div className="social-connect-card">
              <h4>Follow Broccoli on Social Media</h4>
              <div className="social-links-row">
                <a
                  className="social-pill"
                  href="https://www.instagram.com/broccolipizzaandpasta/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <SafeIcon icon={FiInstagram} /> Instagram <SafeIcon icon={FiExternalLink} />
                </a>
                <a
                  className="social-pill"
                  href="https://www.facebook.com/Broccolipizzaandpasta"
                  target="_blank"
                  rel="noreferrer"
                >
                  <SafeIcon icon={FiFacebook} /> Facebook <SafeIcon icon={FiExternalLink} />
                </a>
                <a
                  className="social-pill"
                  href="https://www.youtube.com/@broccolipizzapasta7120"
                  target="_blank"
                  rel="noreferrer"
                >
                  <SafeIcon icon={FiYoutube} /> YouTube <SafeIcon icon={FiExternalLink} />
                </a>
              </div>
            </div>
          </div>

          <div className="contact-form-col">
            <div className="form-container-card">
              <div className="form-card-header">
                <h3>Send a Message</h3>
                <p>Fill out the fields below and we’ll get back to you promptly.</p>
              </div>

              {submitted ? (
                <motion.div
                  className="form-success-box"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <SafeIcon icon={FiCheckCircle} className="success-icon" />
                  <h3>Message Sent!</h3>
                  <p>
                    Thank you, <strong>{formData.name}</strong>. Your feedback has been received and routed to our team.
                  </p>
                  <button
                    className="button button-green"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', email: '', topic: 'General Feedback', message: '' });
                    }}
                  >
                    Send another note
                  </button>
                </motion.div>
              ) : (
                <form className="interactive-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="contactName">Your Name *</label>
                    <input
                      type="text"
                      id="contactName"
                      name="name"
                      required
                      placeholder="e.g. Fatima Ali"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contactEmail">Your Email *</label>
                    <input
                      type="email"
                      id="contactEmail"
                      name="email"
                      required
                      placeholder="e.g. fatima@example.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contactTopic">Topic *</label>
                    <select
                      id="contactTopic"
                      name="topic"
                      value={formData.topic}
                      onChange={handleChange}
                    >
                      <option value="General Feedback">General Feedback</option>
                      <option value="Menu Question">Menu & Allergen Question</option>
                      <option value="DIFC Branch">DIFC Branch Experience</option>
                      <option value="Other Locations">Other UAE Locations</option>
                      <option value="Catering & Events">Catering & Large Orders</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="contactMessage">Your Message *</label>
                    <textarea
                      id="contactMessage"
                      name="message"
                      rows="4"
                      required
                      placeholder="Tell us what's on your mind..."
                      value={formData.message}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-submit-row">
                    <button type="submit" className="button button-green submit-btn" disabled={loading}>
                      {loading ? 'Sending...' : <><span>Send Message</span> <SafeIcon icon={FiSend} /></>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ContactPage;
