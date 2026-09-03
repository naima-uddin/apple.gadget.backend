/**
 * One-time migration: replace Bengali policy-page content stored in the
 * Settings collection with the English defaults.
 *
 * The dashboard → Policy Pages editor stores its content in
 * Setting.policyContent (shipping / return / faq / privacy / terms). Sites that
 * ran the old "Quick Setup" have Bengali text saved there. This script replaces
 * any tab whose stored content still contains Bengali characters with the
 * English default for that tab. Tabs that are empty or already English are left
 * untouched, so English customisations are preserved.
 *
 * It also scans footerInfo / contactInfo / aboutContent and reports (does NOT
 * auto-translate) any Bengali it finds there, since those are free-form and
 * store-specific.
 *
 * Run: node scripts/translatePolicyContentToEnglish.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

// Matches any Bengali letter or vowel-sign (not the ৳ Taka symbol or digits).
const BENGALI = /[অ-ৎ]/;
const hasBengali = (val) => {
  if (typeof val === "string") return BENGALI.test(val);
  if (Array.isArray(val)) return val.some(hasBengali);
  if (val && typeof val === "object") return Object.values(val).some(hasBengali);
  return false;
};

// English defaults — mirror of Apple-frontend PolicyPagesEditor DEFAULT_CONTENT.
const DEFAULT_CONTENT = {
  shipping: [
    { question: "Is free shipping available?", answer: "Yes! On purchases of ৳1599 or more, you get completely free delivery nationwide." },
    { question: "What is the delivery charge?", answer: "For any order under ৳1599, a flat ৳69 delivery charge applies — both inside and outside Dhaka." },
    { question: "How long does delivery take in Dhaka?", answer: "Within Dhaka and Chattogram, delivery is usually made within 1–2 working days." },
    { question: "How long does delivery take outside Dhaka?", answer: "Delivery is made nationwide within 3–5 working days. Slight delays may occur during strikes or natural disasters." },
    { question: "Can I pay with bKash / Nagad / Rocket?", answer: "Yes! We support all mobile banking services including bKash, Nagad and Rocket. You can also pay with credit/debit cards." },
    { question: "Is Cash on Delivery (COD) available?", answer: "Yes! You have the option to pay after receiving the product. With COD, inspect the product and pay once you're satisfied." },
    { question: "How do I track my delivery?", answer: "Once your order ships, a tracking number is sent to your phone via SMS and email. You can track your parcel with it." },
    { question: "Can I change the delivery address?", answer: "Yes, but you must contact customer care within 2 hours of placing the order. Once the shipment is dispatched, the address cannot be changed." },
    { question: "What happens if a delivery is missed?", answer: "Our delivery agent will call you. If we can't reach you, delivery will be reattempted the next working day. After 3 consecutive misses, the order will be cancelled and the refund process started." },
    { question: "Can I collect products from a Pickup Point?", answer: "Yes! If you choose the 'Click & Collect' option while ordering, you can collect the product from our point without any delivery charge." },
    { question: "Do you offer international delivery?", answer: "No, we currently deliver only within Bangladesh." },
    { question: "How are products packed?", answer: "Every product is packed in a sturdy cardboard box along with an invoice. Fragile items are protected with extra bubble wrap." },
  ],
  return: [
    { question: "Within how many days can a product be returned?", answer: "You must apply for a return within 3 days (72 hours) of receiving the product. Returns will not be accepted after that." },
    { question: "In which cases can a product be returned?", answer: "A product can be returned for the following reasons:\n• Defective or damaged product\n• Wrong product delivered\n• Damaged packaging\n• Product does not match the advertisement" },
    { question: "Which products cannot be returned?", answer: "The following products cannot be returned:\n• Used or seal-broken products\n• Digital products and software\n• Customized products\n• Innerwear and hygiene products\n• Food items" },
    { question: "How do I make a return?", answer: "To make a return:\n1. Call our customer care\n2. Report the issue with photos or a video of the product\n3. Our team will contact you within 24 hours" },
    { question: "Is there a pick-up facility in Dhaka?", answer: "Yes! For defective products within Dhaka, our agent will pick up from your home free of charge. From outside Dhaka, you'll need to send it by courier." },
    { question: "Is the product checked after a return?", answer: "Yes, our QC team verifies the product after receiving it. If a defect is confirmed, a replacement or full refund will be provided." },
    { question: "How long until I get my refund?", answer: "After the product is verified, the refund is issued within 7–10 working days — to bKash, Nagad or the card you paid with." },
    { question: "What is the return charge?", answer: "For defective products the return charge is completely free. For returns due to a customer mistake (wrong size, change of mind), the customer bears the courier charge." },
    { question: "What should I do if I find a problem right after delivery?", answer: "Record a video while opening the package. As soon as you notice a problem, report it to our customer care within 3 days with photos/video." },
  ],
  faq: [
    { question: "How do I track my order?", answer: "When your order ships, a tracking number is sent to your phone via SMS and email. You can also see the real-time status from 'My Orders'." },
    { question: "Can I cancel an order?", answer: "An order can be cancelled within 1 hour of placing it. After processing begins, cancellation is not possible. Contact customer care to cancel." },
    { question: "Are the products genuine and good quality?", answer: "Yes. We source products only from authorized distributors and verified suppliers. Every product passes a quality control check." },
    { question: "Is there a warranty?", answer: "Selected products carry the brand's official warranty. Warranty details are provided on the product page." },
    { question: "Where can I find discount or coupon codes?", answer: "We regularly post offers on our Facebook page and website promo banners. Subscribe to the newsletter for exclusive deals." },
    { question: "Can I order without creating an account?", answer: "Yes, you can order as a guest. However, creating an account makes order tracking, returns and future orders much easier." },
    { question: "Is payment secure?", answer: "Yes, all our payments are processed securely with SSL encryption. Your card or mobile banking details are never stored on our servers." },
    { question: "What should I do if a product is out of stock?", answer: "Click the 'Notify Me' button — you'll be notified by SMS/email as soon as it's back in stock." },
    { question: "What are the customer care hours?", answer: "Our customer care is available from 10 AM to 8 PM (except Fridays), 6 days a week." },
  ],
  privacy: [
    { heading: "What information we collect", content: "When you create an account or place an order, we collect your name, phone number, email, delivery address and order history. We also collect usage data (page visits, clicks) to improve the site." },
    { heading: "How your information is used", content: "Your information is used to process orders, ensure delivery and provide customer support. We never sell your personal information to third parties." },
    { heading: "Cookies policy", content: "We use essential cookies to store login sessions and preferences. Analytics cookies are used only with your consent." },
    { heading: "Data security", content: "All your information is protected with SSL encryption technology. Our servers undergo regular security audits. Payment information is never stored on our servers." },
    { heading: "Your rights", content: "You can contact our support team at any time to request to view, correct or delete your personal information." },
    { heading: "Notice of changes", content: "If any changes are made to this privacy policy, you will be notified on the website and via your registered email." },
  ],
  terms: [
    { heading: "Terms of site use", content: "To use AppleBD BD you must be at least 18 years old. You agree not to access or misuse the site in any unauthorized manner." },
    { heading: "Orders and pricing", content: "All prices are set in Bangladeshi Taka (BDT). In case of a pricing error or unusual circumstances, we reserve the right to cancel any order. The final price is fixed after order confirmation." },
    { heading: "Payment policy", content: "We accept bKash, Nagad, Rocket, credit/debit cards and Cash on Delivery (COD). All payments are processed through secure encryption." },
    { heading: "Delivery and returns", content: "Details about delivery and returns are provided on our Shipping Policy and Return Policy pages. Those policies are considered part of these terms." },
    { heading: "Intellectual property", content: "All content on this site — logos, images, text — is owned by AppleBD BD. Reproduction or commercial use without written permission is prohibited." },
    { heading: "Limitation of liability", content: "AppleBD BD is not liable for any indirect or incidental damages arising from use of the site or products purchased. We are not responsible for delivery delays caused by third-party courier services." },
    { heading: "Changes to terms", content: "We reserve the right to change these terms at any time. If you continue to use the site after changes, you are deemed to have accepted the new terms." },
  ],
};

await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const Setting = (await import("../models/Setting.js")).default;

const doc = await Setting.findOne().lean();
if (!doc) {
  console.log("No settings document found — nothing to migrate.");
  await mongoose.disconnect();
  process.exit(0);
}

const pc = doc.policyContent || {};
const $set = {};
let changed = 0;

for (const key of ["shipping", "return", "faq", "privacy", "terms"]) {
  const current = pc[key];
  if (Array.isArray(current) && current.length > 0 && hasBengali(current)) {
    $set[`policyContent.${key}`] = DEFAULT_CONTENT[key];
    changed++;
    console.log(`• "${key}" tab contained Bengali → replacing with English default (${DEFAULT_CONTENT[key].length} items).`);
  } else {
    console.log(`• "${key}" tab left unchanged (empty or already English).`);
  }
}

if (changed > 0) {
  await Setting.updateOne({ _id: doc._id }, { $set });
  console.log(`\nUpdated ${changed} policy tab(s) to English.`);
} else {
  console.log("\nNo Bengali policy content found — nothing to update.");
}

// Report (do NOT auto-translate) Bengali found in free-form, store-specific fields.
const warnFields = {
  footerInfo: doc.footerInfo,
  contactInfo: doc.contactInfo,
  aboutContent: doc.aboutContent,
  footerColumns: doc.footerColumns,
};
const bengaliFields = Object.entries(warnFields)
  .filter(([, v]) => hasBengali(v))
  .map(([k]) => k);
if (bengaliFields.length) {
  console.log(
    `\n⚠ These free-form fields still contain Bengali and were NOT auto-changed ` +
      `(edit them in the dashboard): ${bengaliFields.join(", ")}`,
  );
}

await mongoose.disconnect();
console.log("Done.");
