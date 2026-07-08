/**
 * Copy lives here, not in components (CLAUDE.md §i18n-ready).
 * Tone: warm, assured, understated. Never "Buy now!!", never emoji in UI copy.
 * Keys are dot-path; Arabic/RTL is a config change, not a rewrite.
 */
export const messages = {
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
  },
  cart: {
    title: "Your bag",
    empty: "Your bag is empty.",
    subtotal: "Subtotal",
    shipping: "Shipping",
    checkout: "Checkout",
    continueShopping: "Continue shopping",
    freeShippingProgress: "You're {remaining} away from complimentary shipping",
    freeShippingEarned: "Complimentary shipping unlocked",
  },
  checkout: {
    title: "Checkout",
    contact: "Contact",
    delivery: "Delivery",
    payment: "Payment",
    edit: "edit",
    payByCard: "Pay by card, Apple Pay or Google Pay",
    cashOnDelivery: "Cash on delivery",
    codNote: "Please prepare {total} for the courier. Card payment on delivery not available.",
    pay: "Pay",
    placeOrder: "Place order",
    confirming: "Confirming your payment…",
    trustSecure: "Secure payment",
    trustReturns: "Easy returns",
    trustAtelier: "Cairo atelier",
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
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    outOfStock: "Some items are no longer available.",
    paymentFailed: "Payment could not be completed.",
  },
} as const;

export type Messages = typeof messages;
