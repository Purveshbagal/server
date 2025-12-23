require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Dish = require('../models/Dish');
const fs = require('fs');
const path = require('path');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany();
    await Restaurant.deleteMany();
    await Dish.deleteMany();

    // Create admin user
    const admin = new User({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
    });
    await admin.save();
    console.log('Admin user created');

    // Create sample restaurants
    const restaurants = [
      {
        name: 'Pizza Palace',
        description: 'Authentic Italian pizzas',
        city: 'New York',
        address: '123 Main St, NY',
        cuisine: ['Italian', 'Pizza'],
        imageUrl: 'uploads/restaurant1.jpg',
        createdBy: admin._id,
      },
      {
        name: 'Burger Barn',
        description: 'Juicy burgers and fries',
        city: 'Los Angeles',
        address: '456 Oak Ave, LA',
        cuisine: ['American', 'Fast Food'],
        imageUrl: 'uploads/restaurant2.jpg',
        createdBy: admin._id,
      },
      {
        name: 'Sushi Spot',
        description: 'Fresh sushi and Japanese cuisine',
        city: 'San Francisco',
        address: '789 Pine St, SF',
        cuisine: ['Japanese', 'Sushi'],
        imageUrl: 'uploads/restaurant3.jpg',
        createdBy: admin._id,
      },
    ];

    const createdRestaurants = await Restaurant.insertMany(restaurants);
    console.log('Restaurants created');

    // Create sample dishes
    const dishes = [
      {
        restaurant: createdRestaurants[0]._id,
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce, mozzarella, and basil',
        price: 12.99,
        category: 'Pizza',
        imageUrl: 'uploads/dish1.jpg',
      },
      {
        restaurant: createdRestaurants[0]._id,
        name: 'Pepperoni Pizza',
        description: 'Pizza with pepperoni and cheese',
        price: 14.99,
        category: 'Pizza',
        imageUrl: 'uploads/dish2.jpg',
      },
      {
        restaurant: createdRestaurants[0]._id,
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter',
        price: 5.99,
        category: 'Veg',
        imageUrl: 'uploads/dish3.jpg',
      },
      {
        restaurant: createdRestaurants[1]._id,
        name: 'Classic Burger',
        description: 'Beef patty with lettuce, tomato, and cheese',
        price: 9.99,
        category: 'Non Veg',
        imageUrl: 'uploads/dish4.jpg',
      },
      {
        restaurant: createdRestaurants[1]._id,
        name: 'French Fries',
        description: 'Crispy golden fries',
        price: 3.99,
        category: 'Veg',
        imageUrl: 'uploads/dish5.jpg',
      },
      {
        restaurant: createdRestaurants[2]._id,
        name: 'California Roll',
        description: 'Crab, avocado, and cucumber roll',
        price: 8.99,
        category: 'Chinese',
        imageUrl: 'uploads/dish6.jpg',
      },
      {
        restaurant: createdRestaurants[2]._id,
        name: 'Salmon Sashimi',
        description: 'Fresh salmon slices',
        price: 15.99,
        category: 'Chinese',
        imageUrl: 'uploads/dish7.jpg',
      },
      {
        restaurant: createdRestaurants[2]._id,
        name: 'Miso Soup',
        description: 'Traditional Japanese soup',
        price: 4.99,
        category: 'Veg',
        imageUrl: 'uploads/dish8.jpg',
      },
    ];

    await Dish.insertMany(dishes);
    console.log('Dishes created');

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Uploads directory created');
    }

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    mongoose.connection.close();
  }
};

const runSeed = async () => {
  await connectDB();
  await seedData();
};

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
