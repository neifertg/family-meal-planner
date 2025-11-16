# Family Meal Planner

A mobile-first Progressive Web App (PWA) to help organize weekly family meals, manage recipes, and simplify grocery shopping. Optimized for smartphones and tablets with offline capability.

## Features (Planned)

- **Weekly Meal Planning**: Plan breakfast, lunch, and dinner for the entire week with touch-friendly interface
- **Recipe Management**: Store and organize your family's favorite recipes with photos
- **Shopping List Generation**: Automatically generate shopping lists from meal plans
- **Dietary Preferences**: Track family members' dietary restrictions and preferences
- **Meal History**: Keep track of past meals to avoid repetition
- **Mobile-Optimized UI**: Swipe gestures, bottom navigation, and responsive design
- **Offline Support**: Access your meal plans and recipes even without internet
- **Add to Home Screen**: Install as a PWA for app-like experience

## Project Structure

```
family-meal-planner/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Application pages/views
│   ├── utils/          # Utility functions and helpers
│   └── styles/         # CSS/styling files
├── public/             # Static assets
├── docs/               # Documentation
└── tests/              # Test files
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/neifertg/family-meal-planner.git

# Navigate to project directory
cd family-meal-planner

# Install dependencies
npm install

# Start the application
npm start
```

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

## Development Roadmap

- [x] Set up basic project structure
- [x] Connect to Vercel for deployment
- [x] Set up Linear integration
- [ ] Choose and configure mobile-first framework (React/Next.js)
- [ ] Design database schema for meals and recipes
- [ ] Implement PWA features (service worker, manifest)
- [ ] Create mobile-optimized meal planning interface
- [ ] Implement recipe storage with image upload
- [ ] Build shopping list generator with swipe-to-check
- [ ] Add user authentication
- [ ] Implement offline functionality
- [ ] Add touch gestures and animations
- [ ] Test on various mobile devices and screen sizes

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
