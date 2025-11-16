# Deployment & Integration Guide

This document provides detailed instructions for the deployment and integration setup for the Family Meal Planner project.

## Vercel Deployment

### Initial Setup
The project is deployed on Vercel and connected to the GitHub repository for automatic deployments.

- **Production URL**: https://family-meal-planner-l42l8c91f-seths-projects-76acb5db.vercel.app
- **Dashboard**: https://vercel.com/seths-projects-76acb5db/family-meal-planner

### Automatic Deployments
- **Production**: Every push to `main` branch triggers a production deployment
- **Preview**: Every pull request creates a preview deployment with a unique URL
- **Build Settings**: Configured automatically by Vercel CLI

### Manual Deployment
To deploy manually from your local machine:

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variables
To add environment variables (for API keys, database URLs, etc.):

1. Go to https://vercel.com/seths-projects-76acb5db/family-meal-planner/settings/environment-variables
2. Add variables for each environment (Production, Preview, Development)
3. Redeploy for changes to take effect

Common variables you may need:
- `DATABASE_URL` - Database connection string
- `NEXT_PUBLIC_API_URL` - Public API endpoint
- `LINEAR_API_KEY` - Linear API key for integrations

## Linear Integration

### Setup Steps

1. **Access Linear Workspace**
   - Go to https://linear.app
   - Navigate to your workspace settings

2. **Enable GitHub Integration**
   - Go to Settings → Integrations
   - Find and click on "GitHub"
   - Click "Add" or "Configure"
   - Authorize Linear to access your GitHub account
   - Select the `neifertg/family-meal-planner` repository

3. **Configure Sync Settings**
   - Enable "Sync GitHub issues to Linear"
   - Enable "Link commits with Linear issue IDs"
   - Enable "Attach PRs to Linear issues"
   - Set default team and project for synced issues

4. **Create Linear Project**
   - Go to Projects in Linear
   - Click "New Project"
   - Name: "Family Meal Planner"
   - Set up workflow states:
     - Backlog
     - Todo
     - In Progress
     - In Review
     - Done
   - Add project description and set target dates

### GitHub Secrets Required

For the GitHub Actions workflows to function, add these secrets to your repository:

1. **LINEAR_API_KEY**
   - Go to Linear Settings → API
   - Create a new Personal API Key
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add new secret: `LINEAR_API_KEY` with the value from Linear

2. **VERCEL_TOKEN** (optional, for custom deploy workflow)
   - Go to Vercel Account Settings → Tokens
   - Create a new token
   - Add to GitHub secrets as `VERCEL_TOKEN`

### Using Linear with GitHub

#### Commit Message Format
Include Linear issue ID in commit messages for automatic linking:

```bash
git commit -m "FMP-123: Add recipe card component"
git commit -m "FMP-124: Fix shopping list bug on mobile"
```

#### Creating Issues
- Create issues directly in Linear for better project management
- Or create GitHub issues which will sync to Linear automatically
- Use the GitHub issue templates for consistent formatting

#### Pull Requests
- Reference Linear issues in PR descriptions: "Closes FMP-123"
- Linear will automatically attach the PR to the issue
- PR status updates will reflect in Linear

## GitHub Actions Workflows

### Linear Sync Workflow
**File**: `.github/workflows/linear-sync.yml`

Automatically syncs issues, PRs, and comments between GitHub and Linear.

### Vercel Deploy Workflow
**File**: `.github/workflows/vercel-deploy.yml`

Handles automated deployments to Vercel on push and PR events.

**Note**: This workflow is optional since Vercel has built-in GitHub integration. Enable it if you need custom deployment logic.

## Monitoring & Logs

### Vercel Logs
View deployment logs and runtime logs:
```bash
vercel logs [deployment-url]
```

Or visit: https://vercel.com/seths-projects-76acb5db/family-meal-planner/logs

### Linear Activity
Track issue updates, commits, and PR activity in the Linear issue timeline.

## Troubleshooting

### Deployment Fails
1. Check Vercel deployment logs
2. Verify build command in `package.json`
3. Check for environment variable issues
4. Review error messages in Vercel dashboard

### Linear Not Syncing
1. Verify `LINEAR_API_KEY` secret is set in GitHub
2. Check Linear integration is still authorized
3. Verify repository is selected in Linear GitHub settings
4. Check Linear issue IDs are formatted correctly in commits

### Preview Deployments Not Working
1. Ensure Vercel GitHub integration is enabled
2. Check repository permissions in Vercel
3. Verify PR is from a branch in the same repository (not a fork)

## Best Practices

1. **Always test locally** before pushing to main
2. **Use feature branches** for new work
3. **Reference Linear issues** in all commits
4. **Review preview deployments** before merging PRs
5. **Keep environment variables** synced between local and Vercel
6. **Monitor deployment status** in Vercel dashboard
7. **Update Linear issues** as work progresses

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Linear API Documentation](https://developers.linear.app/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
