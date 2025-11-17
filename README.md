# Family Meal Planner

A mobile-first web application designed specifically for families who love cooking from scratch but struggle with meal planning. This app helps you plan meals effectively while considering seasonality, budget constraints, inventory management, and nutritional balance.

## Features

### ✅ Implemented (V1 Foundation)

- **Authentication**: Secure sign-up and login with single family account
- **Database Schema**: Complete schema for all planned features
- **Recipe Import**: Automatically import recipes from Mel's Kitchen Cafe and Tastes Better From Scratch
- **Dashboard**: Overview with stats, upcoming meals, and expiring inventory alerts
- **Mobile-First Design**: Bottom navigation and responsive layout optimized for phones
- **Seasonal Produce Database**: Pre-populated with 60+ seasonal fruits, vegetables, and herbs

### 🚧 In Progress (V1 MVP)

- **Recipe Browser**: View, filter, and sort recipes by cost, complexity, seasonality, and ratings
- **Meal Planning Calendar**: Weekly view with smart suggestions based on inventory, budget, and history
- **Inventory Management**: Track pantry items with quantities and expiration dates
- **Shopping List**: Auto-generated from meal plans, organized by category
- **Family Member Profiles**: Track dietary restrictions and meal ratings per person
- **Budget Tracking**: Per-meal cost estimates and monthly budget awareness

### 📋 Planned (Future Enhancements)

- **PWA Features**: Offline support and installable app
- **Recipe Suggestions**: AI-powered recommendations based on preferences and inventory
- **Meal History Analytics**: Track frequency and family favorites

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **Recipe Scraping**: Cheerio

## Quick Start

See [GETTING_STARTED.md](GETTING_STARTED.md) for detailed setup instructions.

### Prerequisites

- Node.js 18+
- A Supabase account (free tier works great)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Copy .env.local and add your Supabase credentials
# See docs/SUPABASE_SETUP.md for details

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment & Project Management

### Live Deployment
- **Production URL**: https://family-meal-planner-l42l8c91f-seths-projects-76acb5db.vercel.app
- **Vercel Dashboard**: https://vercel.com/seths-projects-76acb5db/family-meal-planner
- Automatic deployments on push to `main` branch

### Project Management
This project uses **Linear** for issue tracking and project management:
- Track features, bugs, and tasks in Linear
- GitHub issues automatically sync with Linear
- Use Linear issue IDs in commit messages for automatic linking (e.g., `git commit -m "FMP-123: Add recipe feature"`)
- View project roadmap and sprint planning in Linear workspace

### Development Workflow
1. Create or claim an issue in Linear
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and commit with Linear issue ID
4. Push and create a Pull Request
5. Vercel will automatically create a preview deployment
6. After review and merge, changes deploy to production automatically

## Documentation

- [GETTING_STARTED.md](GETTING_STARTED.md) - Complete setup guide and next steps
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) - Database setup instructions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture overview
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment information

## Development Roadmap

### Phase 1: Foundation (✅ Complete)
- [x] Set up Next.js with TypeScript and Tailwind
- [x] Configure Supabase integration
- [x] Design complete database schema
- [x] Create database migrations
- [x] Implement authentication
- [x] Build navigation and dashboard
- [x] Create recipe scraper for supported sites
- [x] Populate seasonal produce database

### Phase 2: Core Features (🚧 Current)
- [ ] Recipe browser with filters and sorting
- [ ] Recipe detail view with ratings
- [ ] Recipe import UI
- [ ] Family member management
- [ ] Inventory management interface
- [ ] Meal planning calendar with drag-and-drop
- [ ] Shopping list generation
- [ ] Budget tracking visualizations

### Phase 3: Enhancements (📋 Future)
- [ ] PWA features (offline, installable)
- [ ] Recipe recommendations algorithm
- [ ] Meal history analytics
- [ ] Ingredient substitution suggestions
- [ ] Grocery delivery integration

## Contributing

Contributions are welcome! Please follow these steps:

1. Check the [Linear project board](https://linear.app) for available issues
2. Comment on an issue to claim it, or create a new issue
3. Fork the repository and create a feature branch
4. Make your changes following the coding standards
5. Include Linear issue ID in commits (e.g., `FMP-123: Description`)
6. Submit a Pull Request with a clear description
7. Wait for review and address any feedback

### Issue Templates
Use the provided GitHub issue templates for:
- **Bug Reports**: Report issues with the app
- **Feature Requests**: Suggest new features or improvements

## License

This project is licensed under the MIT License.
