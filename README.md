# 🐕 Doggy Daycare Manager

A comprehensive desktop application for managing your doggy daycare business. Keep track of daily attendance, dog records, compliance status, and automatically backup your data to the cloud.

## 📥 Download

### Latest Release (v0.2.0)
- **Windows**: [Download .exe installer](https://github.com/frankaugr/doggy-daycare-app/releases/download/v0.2.0/Doggy.Daycare.Manager_0.2.0_x64-setup.exe)
#### Previous Releases (v0.1.0)
- **Windows**: [Download .exe installer](https://github.com/frankaugr/doggy-daycare-app/releases/download/v0.1.0/Doggy.Daycare.Manager_0.1.0_x64-setup.exe)

## ✨ Features

- 📋 **Daily Checklist Management** - Track attendance, feeding times, and behavioral notes
- 🐾 **Dog Registration** - Store owner contact info, vaccination records, and consent forms
- 📊 **Compliance Monitoring** - Automatic alerts for expired vaccinations and missing consent forms
- ☁️ **Cloud Backup** - Automatic backup to your cloud storage (Dropbox, Google Drive, OneDrive)
- 📧 **Email Integration** - Quick access to email templates for owners
- 📱 **WhatsApp Integration** - Send reminders via WhatsApp
- 💾 **Data Import/Export** - Backup and restore your data manually

## 🚀 Getting Started

### 1. First Launch

When you first open the app, you'll see the default "Your Doggy Daycare" name. Let's personalize it:

1. Click on the **Settings** tab
2. Update your **Business Name** (this will appear in the header)
3. Add your **Business Phone Number** (for WhatsApp integration)
4. Click **Save Settings**

### 2. Adding Your First Dog

Navigate to the **Dog Management** tab and click **Add New Dog**:

**Required Information:**
- Dog Name
- Owner Name
- Phone Number
- Email Address

**Optional Information:**
- Breed
- Age
- Vaccination Date (important for compliance tracking)

Click **Add Dog** to save.

### 3. Setting Up Cloud Backup

Protect your data with automatic cloud backups:

1. Go to **Settings** → **Cloud Backup Settings**
2. Check **"Enable automatic cloud backups"**
3. Set your **Cloud Directory Path**:
   - **Dropbox**: `/Users/YourName/Dropbox/DoggyDaycare/`
   - **Google Drive**: `/Users/YourName/Google Drive/DoggyDaycare/`
   - **OneDrive**: `/Users/YourName/OneDrive/DoggyDaycare/`
4. Configure backup settings:
   - **Maximum Backup Files**: How many backups to keep (default: 100)
   - **Auto-Sync Interval**: How often to backup when online (default: 30 minutes)
5. Click **Save Settings**

The app will automatically create timestamped backup files like:
```
doggy-daycare-backup-2024-01-15T14-30-45-123Z.json
```

### 4. Understanding the Connection Status

Look for the connection indicator in the top-right corner:

- 🟢 **Online** - Connected to internet, ready to sync
- 🔵 **Syncing** - Currently backing up data
- ✅ **Synced** - Backup completed successfully
- ⚠️ **Error** - Backup failed (check your cloud directory path)
- ⚫ **Offline** - No internet connection

Click the status indicator to see details and manually trigger a sync.

## 📋 Daily Operations

### Managing Daily Attendance

1. Go to **Daily Checklist** tab
2. Select dogs attending today using the checkboxes
3. For each attending dog, track:
   - **Behavioral checklist** (Eating well, Playing, etc.)
   - **Drop-off and pick-up times**
   - **Feeding schedule**
   - **Special notes**

### Compliance Monitoring

The **Compliance Status** tab automatically tracks:
- Dogs with missing consent forms (overdue monthly signatures)
- Dogs with expired or expiring vaccinations
- Overall compliance statistics

Use the email and WhatsApp buttons to quickly send reminders to owners.

## ⚙️ Settings Guide

### Email Templates

Customize your communication templates with placeholders:

**Available Variables:**
- `{dogName}` - The dog's name
- `{ownerName}` - Owner's name
- `{ownerEmail}` - Owner's email
- `{currentDate}` - Today's date
- `{vaccineType}` - Type of vaccination (vaccine reminders only)
- `{expirationDate}` - Vaccination expiry date (vaccine reminders only)

### WhatsApp Templates

Set up quick WhatsApp messages with the same placeholder system. Make sure to include your country code in the business phone number (e.g., `+1234567890`).

### Cloud Backup Configuration

- **Enable automatic cloud backups**: Turn on/off the backup feature
- **Cloud Directory Path**: Full path to your cloud-synced folder
- **Maximum Backup Files**: Older backups are automatically deleted when this limit is reached
- **Auto-Sync Interval**: How frequently to backup when online (5-480 minutes)

## 💾 Data Management

### Manual Backup/Restore

In the **Dog Management** tab:
- **Export Data**: Download a JSON backup of all your data
- **Import Data**: Restore from a previously exported backup file

### Data Location

Your data is stored locally at:
- **Windows**: `%APPDATA%\doggy-daycare\data.json`
- **macOS**: `~/Library/Application Support/doggy-daycare/data.json`
- **Linux**: `~/.local/share/doggy-daycare/data.json`

During development, data is stored in the project folder as `doggy-daycare-dev-data/data.json`.

## 🔧 Troubleshooting

### Cloud Backup Issues

**"Cloud directory does not exist" error:**
- Ensure the folder path exists and is accessible
- Check that your cloud storage app is running and synced
- Verify the path format matches your operating system

**Backups not syncing:**
- Check your internet connection status
- Verify the cloud directory has write permissions
- Try clicking the manual sync button in the connection status panel

### Data Recovery

If you need to restore your data:
1. Go to **Dog Management** → **Import Data**
2. Select your backup file (either manual export or cloud backup)
3. Confirm the import - this will replace all current data

### Performance Issues

- Cloud backups run in the background and shouldn't affect app performance
- If experiencing slowdowns, try increasing the sync interval in settings
- Check that your cloud storage isn't consuming excessive system resources

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/frankaugr/doggy-daycare-app.git
cd doggy-daycare-app

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Requirements

- Node.js 18+
- Rust 1.70+
- Platform-specific dependencies for Tauri

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Search existing [GitHub Issues](https://github.com/frankaugr/doggy-daycare-app/issues)
3. Create a new issue with detailed information about your problem

---

**Made with ❤️ for doggy daycare providers everywhere**
