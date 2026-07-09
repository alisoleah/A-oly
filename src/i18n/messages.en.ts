/**
 * English UI dictionary (CLAUDE.md §i18n-ready).
 * Tone: warm, assured, understated. Never "Buy now!!", never emoji in UI copy.
 * Template tokens: {count}, {total}, {email}, {remaining} — resolved via .replace().
 *
 * NOTE: `Messages` is a structural type with `string` values (NOT literal
 * types) so the Arabic dictionary can satisfy it — `as const` would lock every
 * value to its exact English string and break the Arabic translation.
 */
export const messagesEn = {
  brand: {
    name: "aïoly",
    tagline: "maison de mode",
    promise: "one perfect piece",
  },
  nav: {
    aether: "Aether",
    aethra: "Aethra",
    about: "About",
    journal: "Journal",
    search: "Search",
    cart: "Cart",
    menu: "Menu",
    closeMenu: "Close menu",
    primaryNav: "Primary",
    secondaryNav: "Secondary",
    mobileNav: "Mobile",
    switchToArabic: "العربية",
    switchToEnglish: "English",
  },
  home: {
    heroEyebrow: "maison de mode — cairo",
    heroTitle: "one perfect piece",
    heroBody:
      "A small wardrobe of considered garments, cut in Como-woven cloth and finished by hand in our Cairo atelier.",
    heroCta: "Explore the collection",
    collectionsEyebrow: "the house",
    collectionsTitle: "two lines, one discipline",
    collectionsAether: {
      name: "Aether",
      blurb:
        "The foundation line — everyday architecture in wool and cotton. The pieces you reach for first.",
    },
    collectionsAethra: {
      name: "Aethra",
      blurb:
        "The signature line — drape, asymmetry, and the pieces that began the house.",
    },
    featuredEyebrow: "the signature",
    featuredTitle: "where the house began",
    featuredBody:
      "The Signature Asymmetric Draped Pants — one piece, perfected over a year of fittings, cut once and never changed.",
    theCollection: "the collection",
  },
  product: {
    addToCart: "Add to cart",
    addedToCart: "Added to bag",
    soldOut: "Sold out",
    lowStock: "Low stock",
    notifyMe: "Notify me",
    selectSize: "Select a size",
    size: "Size",
    color: "Colour",
    fabric: "Fabric",
    care: "Care",
    description: "Description",
    freeShippingNote: "Complimentary shipping over EGP 5,000",
    quickView: "Quick view",
    closeQuickView: "Close quick view",
    viewDetails: "View full details",
    noImage: "No image available",
  },
  catalog: {
    filter: "Filter",
    sort: "Sort",
    size: "Size",
    colour: "Colour",
    clearAll: "Clear all",
    showing: "Showing {count} {count, plural, one {piece} other {pieces}}",
    sortBy: {
      featured: "Featured",
      priceAsc: "Price: low to high",
      priceDesc: "Price: high to low",
      nameAsc: "Name: A to Z",
    },
    quickView: "Quick view",
    viewDetails: "View full details",
    scrollToTop: "Back to top",
    noResults: "No pieces match these filters.",
    adjustFilters: "Try adjusting or clearing filters.",
    closeFilters: "Close filters",
    show: "Show results",
  },
  cart: {
    title: "Your bag",
    empty: "Your bag is empty.",
    subtotal: "Subtotal",
    shipping: "Shipping",
    free: "Free",
    each: "each",
    summary: "Summary",
    total: "Total",
    checkout: "Checkout",
    continueShopping: "Continue shopping",
    freeShippingProgress: "You're {remaining} away from complimentary shipping",
    freeShippingEarned: "Complimentary shipping unlocked",
    closeCart: "Close cart",
    close: "Close",
    decreaseQty: "Decrease quantity",
    increaseQty: "Increase quantity",
    remove: "Remove",
  },
  checkout: {
    title: "Checkout",
    contact: "Contact",
    delivery: "Delivery",
    payment: "Payment",
    paymentMethod: "Payment method",
    edit: "edit",
    payByCard: "Pay by card, Apple Pay or Google Pay",
    cardDescription: "Card, Apple Pay, or Google Pay — wallets show on supported devices.",
    cashOnDelivery: "Cash on delivery",
    codNote: "Please prepare {total} for the courier. Card payment on delivery not available.",
    pay: "Pay",
    placeOrder: "Place order",
    placingOrder: "Placing order…",
    continueToDelivery: "Continue to delivery",
    continueToPayment: "Continue to payment",
    back: "Back",
    confirming: "Confirming your payment…",
    trustSecure: "Secure payment",
    trustReturns: "Easy returns",
    trustAtelier: "Cairo atelier",
    orderSummary: "Order summary",
    // Form fields
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    email: "Email",
    emailHint: "Your order confirmation will be sent here.",
    phone: "Phone",
    phonePlaceholder: "01012345678",
    phoneHint: "Egyptian mobile, for delivery.",
    governorate: "Governorate",
    city: "City / Area",
    address: "Address",
    addressPlaceholder: "Building, street, area",
    addressOptional: "Apartment, floor (optional)",
    notesOptional: "Delivery notes (optional)",
  },
  footer: {
    shop: "Shop",
    house: "House",
    care: "Care",
    newsletter: "Letters from the atelier",
    newsletterBody:
      "Occasional notes on new pieces, fabric, and the making of the collection. No noise.",
    subscribe: "Subscribe",
    emailPlaceholder: "Email address",
    rights: "All rights reserved.",
    paymentMethods: "Accepted payment methods",
    links: {
      aether: "Aether",
      aethra: "Aethra",
      about: "About the house",
      journal: "Journal",
      shipping: "Shipping & returns",
      sizing: "Sizing guide",
      contact: "Contact",
      privacy: "Privacy",
    },
  },
  order: {
    confirmed: "Order confirmed",
    confirmedBody: "A confirmation has been sent to {email}.",
    number: "Order",
    codPrepare: "Please prepare {total} in cash for the courier.",
    total: "Total",
    status: "Status",
    title: "Order confirmed",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    outOfStock: "Some items are no longer available.",
    paymentFailed: "Payment could not be completed.",
    paymentNotConfirmed: "Your payment could not be confirmed.",
    notFoundTitle: "404",
    notFoundHeading: "this page isn't here",
    notFoundBody: "The page may have moved, or perhaps it was never sewn.",
    backHome: "Back to home",
    errorTitle: "something went wrong",
    errorHeading: "a moment, please",
    errorBody: "We hit an unexpected snag. Our team has been notified.",
    tryAgain: "Try again",
  },
};

/**
 * Structural type for a message dictionary — `string` values (not literals) so
 * both English and Arabic dictionaries satisfy it. Defined explicitly rather
 * than via `typeof messagesEn` to avoid locking to English literal types.
 */
export interface Messages {
  brand: { name: string; tagline: string; promise: string };
  nav: {
    aether: string; aethra: string; about: string; journal: string;
    search: string; cart: string; menu: string; closeMenu: string;
    primaryNav: string; secondaryNav: string; mobileNav: string;
    switchToArabic: string; switchToEnglish: string;
  };
  home: {
    heroEyebrow: string; heroTitle: string; heroBody: string; heroCta: string;
    collectionsEyebrow: string; collectionsTitle: string;
    collectionsAether: { name: string; blurb: string };
    collectionsAethra: { name: string; blurb: string };
    featuredEyebrow: string; featuredTitle: string; featuredBody: string;
    theCollection: string;
  };
  product: {
    addToCart: string; addedToCart: string; soldOut: string; lowStock: string;
    notifyMe: string; selectSize: string; size: string; color: string;
    fabric: string; care: string; description: string; freeShippingNote: string;
    quickView: string; closeQuickView: string; viewDetails: string; noImage: string;
  };
  catalog: {
    filter: string; sort: string; size: string; colour: string; clearAll: string;
    showing: string;
    sortBy: { featured: string; priceAsc: string; priceDesc: string; nameAsc: string };
    quickView: string; viewDetails: string; scrollToTop: string;
    noResults: string; adjustFilters: string; closeFilters: string; show: string;
  };
  cart: {
    title: string; empty: string; subtotal: string; shipping: string;
    free: string; each: string; summary: string; total: string;
    checkout: string; continueShopping: string;
    freeShippingProgress: string; freeShippingEarned: string;
    closeCart: string; close: string; decreaseQty: string; increaseQty: string;
    remove: string;
  };
  checkout: {
    title: string; contact: string; delivery: string; payment: string;
    paymentMethod: string; edit: string; payByCard: string; cardDescription: string;
    cashOnDelivery: string; codNote: string; pay: string; placeOrder: string;
    placingOrder: string; continueToDelivery: string; continueToPayment: string;
    back: string; confirming: string; trustSecure: string; trustReturns: string;
    trustAtelier: string; orderSummary: string;
    fullName: string; fullNamePlaceholder: string;
    email: string; emailHint: string;
    phone: string; phonePlaceholder: string; phoneHint: string;
    governorate: string; city: string; address: string; addressPlaceholder: string;
    addressOptional: string; notesOptional: string;
  };
  footer: {
    shop: string; house: string; care: string;
    newsletter: string; newsletterBody: string; subscribe: string;
    emailPlaceholder: string; rights: string; paymentMethods: string;
    links: {
      aether: string; aethra: string; about: string; journal: string;
      shipping: string; sizing: string; contact: string; privacy: string;
    };
  };
  order: {
    confirmed: string; confirmedBody: string; number: string;
    codPrepare: string; total: string; status: string; title: string;
  };
  errors: {
    generic: string; outOfStock: string; paymentFailed: string;
    paymentNotConfirmed: string; notFoundTitle: string; notFoundHeading: string;
    notFoundBody: string; backHome: string; errorTitle: string;
    errorHeading: string; errorBody: string; tryAgain: string;
  };
}
