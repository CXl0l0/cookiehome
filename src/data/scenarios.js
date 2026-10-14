// Scenarios are data, not code: add a home or a category here without touching the engine.
export const scenarios = [
  {
    id: "daily-news",
    name: "The Daily Post",
    owner: "Mrs. Tan, the editor",
    story: "You arrive to read the morning edition. The front door needs to work so the pages can load; Mrs. Tan can remember your name and reading settings for next time. A visitor counter would count which rooms are popular, and an ad salesman wants to follow you to other homes. Tell Mrs. Tan who you’d welcome—one note can include both yeses and nos.",
    guests: [
      { id: "dn-session", name: "Door keeper", category: "essential", party: "first",
        request: "Keeps the front door working so pages load properly." },
      { id: "dn-login", name: "Mrs. Tan", category: "authentication", party: "first",
        request: "Wants to remember your name so you don't have to introduce yourself each visit." },
      { id: "dn-lang", name: "Mrs. Tan's notebook", category: "functionality", party: "first",
        request: "Remembers that you prefer English and a large font." },
      { id: "dn-stats", name: "Visitor counter", category: "analytics", party: "third",
        request: "Watches which rooms you walk through to see what is popular." },
      { id: "dn-ads", name: "Ad salesman", category: "advertising", party: "third",
        request: "Wants to follow what you do in the house and use it to sell you things." },
    ],
  },
  {
    id: "fit-shop",
    name: "FitShop",
    owner: "Mr. Lim, the shopkeeper",
    story: "You stop by FitShop to browse for new shoes. A basket needs to hold your picks while you look around, and Mr. Lim can remember your size and favourite colours. A foot-traffic watcher wants to count how long you spend in each aisle, while a billboard van driver wants to show you ads based on what you viewed here. Tell Mr. Lim what feels okay to remember or share.",
    guests: [
      { id: "fs-cart", name: "Cart basket", category: "essential", party: "first",
        request: "Holds the things you picked while you browse." },
      { id: "fs-prefs", name: "Mr. Lim's notebook", category: "functionality", party: "first",
        request: "Remembers your shoe size and favourite colours." },
      { id: "fs-stats", name: "Foot-traffic watcher", category: "analytics", party: "third",
        request: "Counts how long you stand in each aisle." },
      { id: "fs-ads", name: "Billboard van driver", category: "advertising", party: "third",
        request: "Wants to note what you looked at and show it to you on other houses' walls." },
    ],
  },
];
