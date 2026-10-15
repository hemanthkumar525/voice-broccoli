import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiCheckCircle, FiSend, FiFileText, FiUsers, FiGlobe, FiAlertCircle } = FiIcons;

function FranchisePage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    experience: '',
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
    <div className="franchise-page">
      <section className="page-hero">
        <span className="eyebrow">
          <span className="eyebrow-dot" /> GLOBAL EXPANSION
        </span>
        <h1>Grow with <em>Broccoli.</em></h1>
        <p className="page-hero-subtitle">
          Interested in exploring a Broccoli Pizza & Pasta franchise opportunity? Review the application steps and submit your details for the development team to assess.
        </p>
      </section>

      <section className="franchise-steps-section section-wrap">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" /> THE APPLICATION STEPS</span>
            <h2>How the process <em>works.</em></h2>
          </div>
          <p>A transparent and collaborative framework for prospective franchise partners.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <span className="step-number">01</span>
            <div className="step-icon"><SafeIcon icon={FiFileText} /></div>
            <h3>Introduce Your Market</h3>
            <p>Complete the preliminary enquiry form below detailing your background, team capability, and targeted territory or country.</p>
          </div>

          <div className="step-card">
            <span className="step-number">02</span>
            <div className="step-icon"><SafeIcon icon={FiUsers} /></div>
            <h3>Assessment & Alignment</h3>
            <p>Our international development team reviews local market viability, franchise suitability, and brand synergy in your selected region.</p>
          </div>

          <div className="step-card">
            <span className="step-number">03</span>
            <div className="step-icon"><SafeIcon icon={FiGlobe} /></div>
            <h3>Direct Commercial Consultation</h3>
            <p>Qualified applicants receive formal consultations to review confirmed operational guidelines, training, and territory agreements.</p>
          </div>
        </div>
      </section>

      <section className="franchise-form-section section-wrap">
        <div className="form-container-card">
          <div className="form-card-header">
            <span className="eyebrow"><span className="eyebrow-dot" /> SUBMIT AN ENQUIRY</span>
            <h2>Franchise <em>Application Form</em></h2>
            <p>Tell us about yourself and the market you are interested in developing.</p>
          </div>

          {submitted ? (
            <motion.div
              className="form-success-box"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <SafeIcon icon={FiCheckCircle} className="success-icon" />
              <h3>Thank you, {formData.fullName || 'Partner'}!</h3>
              <p>
                Your franchise enquiry has been received. Our expansion team will review your market details and get in touch via email at <strong>{formData.email}</strong>.
              </p>
              <button
                className="button button-green"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ fullName: '', email: '', phone: '', country: '', experience: '', message: '' });
                }}
              >
                Submit another enquiry
              </button>
            </motion.div>
          ) : (
            <form className="interactive-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fullName">Full Name *</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    required
                    placeholder="e.g. Tariq Al Mansoori"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="e.g. tariq@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone / Mobile Number *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    placeholder="+971 50 123 4567"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="country">Target City & Country *</label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    required
                    placeholder="e.g. Dubai, UAE or Riyadh, KSA"
                    value={formData.country}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="experience">Business / F&B Experience</label>
                <input
                  type="text"
                  id="experience"
                  name="experience"
                  placeholder="e.g. Multi-unit hospitality operator, retail investor"
                  value={formData.experience}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message / Proposed Development Plan</label>
                <textarea
                  id="message"
                  name="message"
                  rows="4"
                  placeholder="Share details about your background, proposed locations, or timeline..."
                  value={formData.message}
                  onChange={handleChange}
                />
              </div>

              <div className="form-submit-row">
                <button type="submit" className="button button-green submit-btn" disabled={loading}>
                  {loading ? 'Submitting...' : <><span>Send Franchise Enquiry</span> <SafeIcon icon={FiSend} /></>}
                </button>
              </div>
            </form>
          )}

          <div className="form-disclaimer">
            <SafeIcon icon={FiAlertCircle} />
            <span>
              <strong>Important Notice:</strong> Submitting an enquiry does not create an offer, approval, or franchise agreement. Commercial terms, fees, and territories must be verified and approved directly with authorized Broccoli representatives.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FranchisePage;

