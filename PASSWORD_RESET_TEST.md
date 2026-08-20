# Password Reset Testing Guide

## Prerequisites
- [ ] Added redirect URLs to Supabase allowlist
- [ ] Verified email templates are enabled
- [ ] Waited 1 hour if previously tested (rate limit)

## Test Steps

### Step 1: Request Password Reset
1. Open incognito/private browser window
2. Go to: http://localhost:3000/auth/reset-password
3. Enter a valid registered email
4. Click "Send Reset Link"
5. You should see: "Check your email for a password reset link"

### Step 2: Check Email
1. Check inbox (and spam folder)
2. Look for email from: noreply@mail.app.supabase.io
3. Subject should be: "Reset Your Password"
4. Click the reset link in the email

### Step 3: Update Password
1. Should redirect to: http://localhost:3000/auth/update-password
2. Enter new password (min 6 characters)
3. Confirm password matches
4. Click "Update Password"
5. Should see: "Password updated successfully!"
6. Should redirect to: /dashboard

### Step 4: Verify Login
1. Log out if still logged in
2. Go to: http://localhost:3000/auth/login
3. Try logging in with OLD password → should FAIL
4. Try logging in with NEW password → should SUCCESS

## Troubleshooting

### Email Not Arriving
- **Wait 1 hour** - default SMTP has 3 emails/hour limit per address
- Check **spam folder**
- Verify email is registered: Supabase Dashboard → Authentication → Users
- Check logs: Supabase Dashboard → Authentication → Logs
- Try different email address

### "Invalid or expired reset link"
- Links expire after **1 hour**
- Each new reset request invalidates previous links
- Clear browser cache and try again
- Verify redirect URL is in Supabase allowlist

### Password Not Updating
- Check browser console for errors
- Verify session exists after clicking email link
- Ensure password meets requirements (6+ characters)

## Default SMTP Rate Limits

| Limit Type | Value |
|------------|-------|
| Emails per hour (same address) | 3 |
| Total daily emails | Varies by plan |

**Note**: For production with many users, consider upgrading to custom SMTP provider (SendGrid, AWS SES, etc.)

## Supabase Dashboard Checklist

### URL Configuration
- [ ] http://localhost:3000/auth/update-password
- [ ] https://your-production-url/auth/update-password

### Email Templates
- [ ] "Reset Password" template enabled
- [ ] Template contains `{{ .ConfirmationURL }}`

### SMTP Settings
- [x] Using default Supabase SMTP (current setup)
- [ ] Custom SMTP configured (for production)

## Known Issues with Default SMTP

1. **Rate Limiting**: Can only send 3 emails per hour to same address
2. **Deliverability**: May go to spam more often than custom SMTP
3. **No Custom Branding**: Uses Supabase branding in emails

**Recommendation**: Once working, upgrade to custom SMTP for production use.
