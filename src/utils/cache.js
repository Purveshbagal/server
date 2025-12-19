class Cache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  set(key, value, ttl = 3600000) { // Default 1 hour
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Store value
    this.store.set(key, {
      value,
      createdAt: Date.now(),
      ttl,
    });

    // Set expiration
    if (ttl) {
      const timer = setTimeout(() => this.delete(key), ttl);
      this.timers.set(key, timer);
    }
  }

  get(key) {
    if (!this.store.has(key)) return null;

    const cached = this.store.get(key);
    const age = Date.now() - cached.createdAt;

    // Check if expired
    if (cached.ttl && age > cached.ttl) {
      this.delete(key);
      return null;
    }

    return cached.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.store.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  clear() {
    this.store.forEach((_, key) => this.delete(key));
  }

  size() {
    return this.store.size;
  }

  // For listing restaurants (cached for 5 minutes)
  getAllRestaurantsKey() {
    return 'restaurants:all';
  }

  // For individual restaurant details (cached for 10 minutes)
  getRestaurantKey(id) {
    return `restaurant:${id}`;
  }

  // For dishes by restaurant (cached for 5 minutes)
  getDishesByRestaurantKey(restaurantId) {
    return `restaurant:${restaurantId}:dishes`;
  }

  invalidateRestaurantCache(restaurantId) {
    this.delete(this.getAllRestaurantsKey());
    this.delete(this.getRestaurantKey(restaurantId));
    this.delete(this.getDishesByRestaurantKey(restaurantId));
  }
}

module.exports = new Cache();
