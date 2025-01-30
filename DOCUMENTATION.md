# Reminder Bot Documentation

## File Structure
- **index.js**: Main logic for the bot, including command handling and reminder management.
- **config.json**: Configuration file containing the bot token and user settings.
- **logs.txt**: Log file for recording bot actions and errors.

## Code Explanation

### index.js
- **Imports**: The bot uses `discord.js` for Discord interactions and `fs` for file operations.
- **Client Initialization**: A new Discord client is created with the necessary intents.
- **Reminder Management**: 
  - Reminders are loaded from `db.json` and managed in memory.
  - The `log` function records messages to both the console and `logs.txt`.
- **Logging**: 
  - The `log` function records messages to both the console and `logs.txt`.
- **Command Registration**: 
  - Slash commands are registered with Discord's API using the `REST` class.
- **Interaction Handling**: 
  - The bot responds to user commands through the `interactionCreate` event.
  - Each command is validated, and appropriate actions are taken based on the command name.
- **Daily Reminders**: 
  - The bot checks for reminders due each day and sends notifications to users.

### config.json
- **token**: The Discord bot token for authentication.
- **whitelist**: An array of user IDs allowed to use the bot.
- **dailyReminderTime**: The time at which daily reminders are sent in HH:MM format.
- **pingIntervals**: An array of intervals (in days) for reminder pings.