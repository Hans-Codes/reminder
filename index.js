const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Load or initialize reminders
const dataFilePath = path.join(__dirname, 'db.json');
let reminders = {};
try {
    if (fs.existsSync(dataFilePath)) {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        reminders = JSON.parse(data);
    }
} catch (error) {
    console.error('Error reading reminders:', error);
}

// Logging function
const logFilePath = path.join(__dirname, 'logs.txt');
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    try {
        fs.appendFileSync(logFilePath, logMessage + '\n', 'utf8');
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

// Date validation function
function isValidDate(dateStr) {
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/; // Format check: DD-MM-YYYY
    if (!dateRegex.test(dateStr)) return false;

    const [day, month, year] = dateStr.split('-').map(Number);

    // Check month range
    if (month < 1 || month > 12) return false;

    // Check day range based on month and leap year for February
    const daysInMonth = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > daysInMonth[month - 1]) return false;

    return true;
}

// Register slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a new reminder')
        .addStringOption(option => option.setName('subject').setDescription('Subject name').setRequired(true))
        .addStringOption(option => option.setName('event').setDescription('Event name').setRequired(true))
        .addStringOption(option => option.setName('deadline').setDescription('Deadline (DD-MM-YYYY)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('View your reminder schedule'),
    new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Delete a reminder')
        .addStringOption(option => option.setName('subject').setDescription('Subject name of the reminder to delete').setRequired(true))
        .addStringOption(option => option.setName('event').setDescription('Event name of the reminder to delete').setRequired(false)), // Optional event parameter
    new SlashCommandBuilder()
        .setName('edit')
        .setDescription('Edit an existing reminder event')
        .addStringOption(option => option.setName('subject').setDescription('Subject name of the reminder to edit').setRequired(true))
        .addStringOption(option => option.setName('event').setDescription('Event name to edit').setRequired(true))
        .addStringOption(option => option.setName('new_event').setDescription('New event name').setRequired(false))
        .addStringOption(option => option.setName('new_deadline').setDescription('New deadline (DD-MM-YYYY)').setRequired(false))
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user && client.user.id || '1291043691091333202'),
            { body: commands.map(command => command.toJSON()), global: true } // Register globally
        );
        log('Slash commands registered successfully!');
    } catch (error) {
        log(`Error registering slash commands: ${error.message}`, 'error');
    }
})();

// Check for past reminders on startup
const now = new Date();
for (const userId in reminders) {
    for (const subject in reminders[userId]) {
        reminders[userId][subject].events = reminders[userId][subject].events.filter(event => {
            const eventDate = new Date(event.deadline.split('-').reverse().join('-'));
            if (eventDate < now) {
                log(`Deleting past reminder for user ${userId}: [${subject}] ${event.event} (Deadline: ${event.deadline})`, 'info');
                return false; // Remove past events
            }
            return true; // Keep future events
        });
        // If no events remain, delete the subject
        if (reminders[userId][subject].events.length === 0) {
            delete reminders[userId][subject];
        }
    }
}

// Save updated reminders
try {
    fs.writeFileSync(dataFilePath, JSON.stringify(reminders, null, 2), 'utf8');
} catch (error) {
    log('Error writing updated reminders to file: ' + error.message, 'error');
}

// Slash command handling
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const userId = interaction.user.id;
    if (!config.whitelist.includes(userId)) {
        await interaction.reply({ content: 'You are not authorized to use this bot.', ephemeral: true });
        log(`Unauthorized access attempt by ${userId}.`, 'warning');
        return;
    }

    const { commandName, options } = interaction;
    if (commandName === 'add') {
        const subject = options.getString('subject');
        const event = options.getString('event');
        const deadline = options.getString('deadline');

        // Validate deadline format
        if (!isValidDate(deadline)) {
            await interaction.reply({ content: 'Invalid date. Please use a valid date in DD-MM-YYYY format.', ephemeral: true });
            return;
        }

        if (!reminders[userId]) reminders[userId] = {};
        
        // Check if the deadline is in the past
        const deadlineDate = new Date(deadline.split('-').reverse().join('-'));
        if (deadlineDate < now) {
            await interaction.reply({ content: 'Cannot set a reminder for a past date.', ephemeral: true });
            return;
        }
        if (!reminders[userId][subject]) {
            reminders[userId][subject] = { 
                events: [], 
                reminderSentDate: {} 
            };
        }

        reminders[userId][subject].events.push({ event, deadline });
        try {
            fs.writeFileSync(dataFilePath, JSON.stringify(reminders, null, 2), 'utf8');
        } catch (error) {
            await interaction.reply({ content: 'Error saving reminder. Please try again later.', ephemeral: true });
            log('Error writing reminders to file: ' + error.message, 'error');
            return;
        }

        await interaction.reply(`Reminder added for **${subject}**: **${event}** (Deadline: ${deadline})`);
        log(`Added reminder for user ${userId}: [${subject}] ${event} (${deadline})`);
        
    } else if (commandName === 'schedule') {
        const userReminders = reminders[userId];
        if (!userReminders || Object.keys(userReminders).length === 0) {
            await interaction.reply({ content: 'You have no reminders.', ephemeral: true });
            log(`Displayed schedule for user ${userId}, but user has no schedule.`, 'info');
            return;
        }

        let schedule = 'REMINDER\n\n';
        for (const [subject, subjectData] of Object.entries(userReminders)) {
            schedule += `📍**${subject}**\n`;
            subjectData.events.forEach((e, index) => {
                schedule += `${index + 1}. **${e.event}**\n   (${e.deadline})\n`;
            });
            schedule += '\n';
        }

        await interaction.reply({ content: schedule, ephemeral: false });
        log(`Displayed schedule for user ${userId}.`);
        
    } else if (commandName === 'delete') {
        const subject = options.getString('subject');
        const event = options.getString('event');

        if (!reminders[userId] || !reminders[userId][subject]) {
            await interaction.reply({ content: 'Reminder not found.', ephemeral: true });
            log(`Attempted to delete non-existent reminder for user ${userId}: [${subject}]`, 'warning');
            return;
        }

        if (event) {
            const eventIndex = reminders[userId][subject].events.findIndex(e => e.event === event);
            if (eventIndex === -1) {
                await interaction.reply({ content: 'Event not found under this subject.', ephemeral: true });
                log(`Attempted to delete non-existent event for user ${userId}: [${subject}] ${event}`, 'warning');
                return;
            }
            reminders[userId][subject].events.splice(eventIndex, 1);
            if (reminders[userId][subject].events.length === 0) {
                delete reminders[userId][subject]; // Delete subject if no events remain
            }
            await interaction.reply(`Event **${event}** under subject **${subject}** has been deleted.`);
            log(`Deleted event for user ${userId}: [${subject}] ${event}`);
        } else {
            delete reminders[userId][subject]; // Delete the entire subject
            await interaction.reply(`Subject **${subject}** has been deleted.`);
            log(`Deleted subject for user ${userId}: [${subject}]`);
        }

        try {
            fs.writeFileSync(dataFilePath, JSON.stringify(reminders, null, 2), 'utf8');
        } catch (error) {
            await interaction.reply({ content: 'Error deleting reminder. Please try again later.', ephemeral: true });
            log('Error writing reminders to file after deletion: ' + error.message, 'error');
        }
    } else if (commandName === 'edit') {
        const subject = options.getString('subject');
        const event = options.getString('event');
        const newEvent = options.getString('new_event');
        const newDeadline = options.getString('new_deadline');

        if (!reminders[userId] || !reminders[userId][subject]) {
            await interaction.reply({ content: 'Reminder not found.', ephemeral: true });
            log(`Attempted to edit non-existent reminder for user ${userId}: [${subject}]`, 'warning');
            return;
        }

        const eventIndex = reminders[userId][subject].events.findIndex(e => e.event === event);
        if (eventIndex === -1) {
            await interaction.reply({ content: 'Event not found under this subject.', ephemeral: true });
            log(`Attempted to edit non-existent event for user ${userId}: [${subject}] ${event}`, 'warning');
            return;
        }

        if (newEvent) {
            reminders[userId][subject].events[eventIndex].event = newEvent;
        }
        if (newDeadline) {
            if (!isValidDate(newDeadline)) {
                await interaction.reply({ content: 'Invalid date. Please use a valid date in DD-MM-YYYY format.', ephemeral: true });
                return;
            }
            reminders[userId][subject].events[eventIndex].deadline = newDeadline;
        }

        try {
            fs.writeFileSync(dataFilePath, JSON.stringify(reminders, null, 2), 'utf8');
            await interaction.reply(`Event **${event}** under subject **${subject}** has been updated.`);
            log(`Edited event for user ${userId}: [${subject}] ${event}`);
        } catch (error) {
            await interaction.reply({ content: 'Error editing reminder. Please try again later.', ephemeral: true });
            log('Error writing reminders to file after editing: ' + error.message, 'error');
        }
    }
});

// Daily reminders
function sendDailyReminders() {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    for (const [userId, subjects] of Object.entries(reminders)) {
        let dailyMessage = '📅 **Daily Reminder** \n\n';
        let hasReminders = false;

        for (const [subject, subjectData] of Object.entries(subjects)) {
            if (!subjectData.reminderSentDate) {
                subjectData.reminderSentDate = {};
            }

            subjectData.events.forEach((e) => {
                if (e.deadline === today && !subjectData.reminderSentDate[e.event]) {
                    dailyMessage += `📍 **${subject}:** ${e.event} (Due Today!)\n`;
                    hasReminders = true;
                    subjectData.reminderSentDate[e.event] = today;
                }
            });
        }

        if (hasReminders) {
            const user = client.users.cache.get(userId);
            if (user) user.send(dailyMessage);
            log(`Sent daily reminder to ${userId}.`);
        }

        try {
            fs.writeFileSync(dataFilePath, JSON.stringify(reminders, null, 2), 'utf8');
        } catch (error) {
            log('Error writing reminders to file during daily reminders: ' + error.message, 'error');
        }
    }
}

// Reminder pings
function sendReminderPings() {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    const intervals = config.pingIntervals.map((d) => d * 24 * 60 * 60 * 1000); // Convert days to ms

    for (const [userId, subjects] of Object.entries(reminders)) {
        for (const [subject, subjectData] of Object.entries(subjects)) {
            subjectData.events.forEach((e) => {
                const deadline = new Date(e.deadline.split('-').reverse().join('-'));
                const diff = deadline - now;

                // If the event is within the ping interval
                if (intervals.includes(Math.ceil(diff / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24))) {
                    // Check if the reminder has already been sent today
                    if (e.reminderSentDate !== today) {
                        const user = client.users.cache.get(userId);
                        if (user) {
                            user.send(`‼️ **${e.event}** - **Deadline: ${e.deadline} (H-${Math.ceil(diff / (1000 * 60 * 60 * 24))})**‼️ <@${userId}>`);
                            log(`Sent ping for ${e.event} to ${userId}.`);
                        }

                        // Mark the reminder as sent today
                        e.reminderSentDate = today;
                    }
                }
            });
        }
    }
}

// Send H-Day reminder at 8 AM
function sendMorningReminder() {
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() === 0) {
        sendDailyReminders();
    }
}

// Scheduled tasks
setInterval(() => {
    const now = new Date();
    const [hour, minute] = config.dailyReminderTime.split(':').map(Number);
    if (now.getHours() === hour && now.getMinutes() === minute) {
        sendDailyReminders();
    }
    sendReminderPings();
    sendMorningReminder();
}, 60 * 1000); // Check every minute

// Login
client.once('ready', () => log('Bot is ready!'));
client.login(config.token);
