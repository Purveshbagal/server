# Swadhan Eats Backend

A Node.js backend for Swadhan Eats, a food delivery platform.

## Features

- User authentication (register, login, refresh token, logout)
- Restaurant management (CRUD operations)
- Dish management
- Order placement and management
- File uploads for images
- Rate limiting on auth endpoints
- Admin role-based access

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Multer for file uploads
- Joi for validation
- Jest + Supertest for testing

## Setup

1. Clone the repository and navigate to the server folder.

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file with your MongoDB URI and other configurations.

4. Seed the database with initial data:
   ```
   npm run seed
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. For production:
   ```
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

### Restaurants
- `GET /api/restaurants` - Get all restaurants (with filters: city, q, cuisine, pagination)
- `GET /api/restaurants/:id` - Get single restaurant
- `POST /api/restaurants` - Create restaurant (admin only)
- `PUT /api/restaurants/:id` - Update restaurant (admin only)
- `DELETE /api/restaurants/:id` - Delete restaurant (admin only)

### Dishes
- `GET /api/restaurants/:id/dishes` - Get dishes for a restaurant
- `POST /api/restaurants/:id/dishes` - Create dish (admin only)
- `PUT /api/dishes/:id` - Update dish (admin only)
- `DELETE /api/dishes/:id` - Delete dish (admin only)

### Orders
- `POST /api/orders` - Create order (authenticated user)
- `GET /api/orders` - Get user's orders or all orders (admin)
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/status` - Update order status (admin only)

## Sample Requests

### Public User Registration & Login

#### Register a New User
Public users can register with an email and password. After registration, they receive JWT tokens (`accessToken` and `refreshToken`) and can immediately use the `accessToken` to make authenticated requests.

**Endpoint:** `POST /api/auth/register`

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (success):**
```json
{
  "message": "User registered successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### Public User Login
After registration, users can log in with their email and password to obtain new JWT tokens.

**Endpoint:** `POST /api/auth/login`

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (success):**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### Admin Login (Development)

Administrators can log in using a dedicated admin-login endpoint. The repository seeds a development admin user when you run `npm run seed`.

**Default Dev Admin Credentials** (stored in `server/.env`):
- Email: `admin@swadhaneats.com`
- Password: `Admin@123`

**Endpoint:** `POST /api/auth/admin-login`

Obtain an access token for admin-only endpoints:

```bash
curl -X POST http://localhost:5000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@swadhaneats.com",
    "password": "Admin@123"
  }'
```

**Response (success):**
```json
{
  "message": "Admin login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin_id",
    "name": "Admin User",
    "email": "admin@swadhaneats.com",
    "role": "admin"
  }
}
```

#### Admin-Only: Update Restaurant Details

After obtaining an admin access token, use it to edit restaurant details. Only the `name` field is required to be provided; other fields can be updated optionally.

```bash
curl -X PUT http://localhost:5000/api/restaurants/<restaurantId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"name":"Updated Restaurant Name"}'
```

**Example:** Update restaurant with partial data:
```bash
curl -X PUT http://localhost:5000/api/restaurants/693577c1d61d9a9be23b8365 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"name":"Pizza Palace Updated","city":"New York"}'
```

**Notes:**
- Admin users have `role: 'admin'` in the database. This role is required to use admin-only endpoints.
- The email validation was relaxed to accept test domains (e.g. `.test`) in development. Revert this before production if you want strict TLD validation.
- All admin endpoints require a valid JWT access token with `admin` role in the `Authorization: Bearer <token>` header.

### Logout (User & Admin)

Both public users and admins can log out by sending the `refreshToken` to the logout endpoint. This invalidates the refresh token and prevents it from being reused.

**Endpoint:** `POST /api/auth/logout`

#### Public User Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

#### Admin Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (success):**
```json
{
  "message": "Logged out successfully"
}
```

**Frontend Implementation Example:**
After login, store both `accessToken` and `refreshToken` (e.g., in localStorage or state). When the user clicks "Logout":
1. Send the `refreshToken` to `POST /api/auth/logout`.
2. Delete both tokens from storage.
3. Redirect user to login page.

```javascript
// Example: Logout function for React
const logout = async (refreshToken) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (response.ok) {
      // Clear tokens from storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Redirect to login
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

### Refresh Access Token

When your access token expires, use the refresh token to obtain a new access token without requiring the user to log in again.

**Endpoint:** `POST /api/auth/refresh`

```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (success):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Note:** The refresh endpoint also returns a new `refreshToken`. This rotation mechanism improves security by invalidating old refresh tokens after each use.

### Get Restaurants
```bash
curl -X GET "http://localhost:5000/api/restaurants?city=New%20York&page=1&limit=10"
```

### Create Order
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "items": [
      {
        "dish": "dish_id_here",
        "qty": 2
      }
    ],
    "address": "123 Main St",
    "city": "New York"
  }'
```

## Testing

Run tests with:
```
npm test
```

## Production Notes

- Use S3 or similar for image storage instead of local uploads.
- Rotate JWT_SECRET regularly.
- Implement rate limiting on more endpoints.
- Use httpOnly cookies for refresh tokens.
- Sanitize all inputs to prevent injection attacks.

## Testing webhooks (Razorpay) locally with ngrok

Razorpay sends webhook events to a public HTTPS endpoint. When developing locally you can use `ngrok` to expose your local server.

1. Install ngrok from https://ngrok.com and authenticate it:

```powershell
ngrok authtoken <your-ngrok-authtoken>
```

2. Start your server (default port 5000):

```powershell
cd server
npm run dev
```

3. Start the provided helper script to run ngrok and print the public URL (PowerShell):

```powershell
cd server
.\scripts\start-ngrok.ps1 -Port 5000
```

The script will print a public URL such as `https://abcd1234.ngrok.io` and a suggested webhook endpoint:

```
Set your Razorpay webhook URL to: https://abcd1234.ngrok.io/api/payments/razorpay/webhook
```

4. In the Razorpay dashboard (or using Razorpay CLI), configure the webhook URL above and set the signing secret to your `RAZORPAY_KEY_SECRET`.

5. Place a test payment in the client using the Razorpay option and confirm the server receives and verifies the webhook.

Notes:
- The server's webhook endpoint uses `express.raw()` to compute the HMAC signature reliably. Do not add additional JSON body parsers for that path.
- If you prefer, you can use the Razorpay dashboard's webhook tester to send sample events to the ngrok URL.

## License

MIT
