# Reminder Bot

## Overview
This bot is designed to help users manage their reminders on Discord. It allows users to add, edit, delete, and view reminders through simple slash commands.

## Core Features
- **Add Reminders**: Users can add new reminders with a subject, event, and deadline.
- **Edit Reminders**: Users can edit existing reminders.
- **Delete Reminders**: Users can delete specific reminders or entire subjects.
- **View Reminders**: Users can view their scheduled reminders.
- **Daily Reminders**: The bot sends daily reminders to users for events due that day.
- **Logging**: All actions and errors are logged for monitoring and debugging.
- **Date Validation**: Ensures that deadlines are valid and not in the past.
- **User Authorization**: Only whitelisted users can interact with the bot.

## Getting Started
1. Clone the repository.
2. Install dependencies using `npm install`.
3. Configure the bot by updating `config.json` with your Discord bot token and user whitelist.
4. Run the bot using `node index.js`.

## Requirements
- Node.js
- Discord.js library