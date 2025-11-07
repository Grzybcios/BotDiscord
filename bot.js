const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, Events, MessageFlags } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// ==================== KONFIGURACJA ====================
const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'VERIFIED_ROLE_ID',
    'RECRUITMENT_APPLICATIONS_CHANNEL',
    'RECRUITMENT_RESULTS_CHANNEL',
    'TICKET_CATEGORY_ID',
    'MEMBER_LOG_CHANNEL_ID'
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    throw new Error(`Brak wymaganych zmiennych środowiskowych: ${missingEnvVars.join(', ')}`);
}

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    GUILD_ID: process.env.DISCORD_GUILD_ID,
    MINECRAFT_SERVER: process.env.MINECRAFT_SERVER || 'twoj-serwer.pl',
    MINECRAFT_PORT: Number(process.env.MINECRAFT_PORT || 25565),
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID,
    VERIFIED_ROLE_ID: process.env.VERIFIED_ROLE_ID,
    MEMBER_LOG_CHANNEL_ID: process.env.MEMBER_LOG_CHANNEL_ID,
    RECRUITMENT: {
        APPLICATIONS_CHANNEL: process.env.RECRUITMENT_APPLICATIONS_CHANNEL,
        RESULTS_CHANNEL: process.env.RECRUITMENT_RESULTS_CHANNEL
    }
};

// FAQ - edytuj tutaj pytania i odpowiedzi
const faqData = new Map([
    [1, { 
        pytanie: 'Jak dołączyć na serwer?', 
        odpowiedz: 'IP serwera: twoj-serwer.pl' 
    }],
    [2, { 
        pytanie: 'Jakie są zasady serwera?', 
        odpowiedz: 'Sprawdź kanał #regulamin' 
    }],
    [3, { 
        pytanie: 'Jak zgłosić gracza albo inny problem?', 
        odpowiedz: 'Użyj ticketa i opisz problem' 
    }]
]);

// Przechowywanie danych
const tickets = new Map();
const competitions = new Map();
const polls = new Map();
const applications = new Map();
const joinTimestamps = [];
let minecraftStatusMessage = null;
let minecraftStatusChannel = null;

// ==================== KOMENDY SLASH ====================
const commands = [
    {
        name: 'ogłoszenie',
        description: 'Stwórz ogłoszenie z embedem',
        options: [
            {
                name: 'tytuł',
                description: 'Tytuł ogłoszenia',
                type: 3,
                required: true
            },
            {
                name: 'tresc',
                description: 'Treść ogłoszenia',
                type: 3,
                required: true
            },
            {
                name: 'kolor',
                description: 'Kolor w formacie HEX (np. #FF5733)',
                type: 3,
                required: true
            },
            {
                name: 'grafika',
                description: 'URL do grafiki',
                type: 3,
                required: false
            }
        ]
    },
    {
        name: 'ticket-setup',
        description: 'Ustaw system ticketów',
        options: [
            {
                name: 'kanał',
                description: 'Kanał gdzie pojawi się panel ticketów',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'konkurs',
        description: 'Stwórz konkurs',
        options: [
            {
                name: 'tytuł',
                description: 'Tytuł konkursu',
                type: 3,
                required: true
            },
            {
                name: 'opis',
                description: 'Opis konkursu',
                type: 3,
                required: true
            },
            {
                name: 'nagroda',
                description: 'Nagroda',
                type: 3,
                required: true
            },
            {
                name: 'czas',
                description: 'Czas trwania w minutach',
                type: 4,
                required: true
            }
        ]
    },
    {
        name: 'ankieta',
        description: 'Stwórz ankietę',
        options: [
            {
                name: 'pytanie',
                description: 'Pytanie ankiety',
                type: 3,
                required: true
            },
            {
                name: 'opcja1',
                description: 'Pierwsza opcja',
                type: 3,
                required: true
            },
            {
                name: 'opcja2',
                description: 'Druga opcja',
                type: 3,
                required: true
            },
            {
                name: 'opcja3',
                description: 'Trzecia opcja (opcjonalna)',
                type: 3,
                required: false
            },
            {
                name: 'opcja4',
                description: 'Czwarta opcja (opcjonalna)',
                type: 3,
                required: false
            }
        ]
    },
    {
        name: 'faq',
        description: 'Wyświetl FAQ',
        options: [
            {
                name: 'kanał',
                description: 'Kanał, na który wysłać wiadomość FAQ',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'rekrutacja-setup',
        description: 'Ustaw panel rekrutacji',
        options: [
            {
                name: 'kanał',
                description: 'Kanał dla panelu rekrutacji',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'weryfikacja-setup',
        description: 'Ustaw panel weryfikacyjny',
        options: [
            {
                name: 'kanał',
                description: 'Kanał dla panelu weryfikacji',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'minecraft-status',
        description: 'Ustaw kanał ze statusem serwera Minecraft',
        options: [
            {
                name: 'kanał',
                description: 'Kanał dla statusu',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'lockdown',
        description: 'Włącz/wyłącz tryb lockdown',
        options: [
            {
                name: 'status',
                description: 'włącz lub wyłącz',
                type: 3,
                required: true,
                choices: [
                    { name: 'Włącz', value: 'on' },
                    { name: 'Wyłącz', value: 'off' }
                ]
            }
        ]
    }
];

// ==================== REJESTRACJA KOMEND ====================
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    
    try {
        console.log('Rejestrowanie komend slash...');
        await rest.put(
            Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
            { body: commands }
        );
        console.log('Komendy zarejestrowane!');
    } catch (error) {
        console.error('Błąd podczas rejestracji komend:', error);
    }
}

// ==================== EVENT: BOT GOTOWY ====================
client.once(Events.ClientReady, (clientInstance) => {
    console.log(`Bot ${clientInstance.user.tag} jest online!`);
    registerCommands();
});

// ==================== KOMENDY SLASH ====================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // KOMENDA: /ogłoszenie
    if (commandName === 'ogłoszenie') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral });
        }

        const tytul = interaction.options.getString('tytuł');
        const tresc = interaction.options.getString('tresc');
        const kolor = interaction.options.getString('kolor');
        const grafika = interaction.options.getString('grafika');

        const embed = new EmbedBuilder()
            .setTitle(`📢 ${tytul}`)
            .setDescription(`> ${tresc}`)
            .setColor(kolor)
            .setTimestamp()
            .setFooter({ text: 'Bot Serwera' });

        if (grafika) {
            embed.setImage(grafika);
        }

        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Ogłoszenie zostało wysłane!', flags: MessageFlags.Ephemeral });
    }

    // KOMENDA: /ticket-setup
    if (commandName === 'ticket-setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral });
        }

        const kanal = interaction.options.getChannel('kanał');

        const embed = new EmbedBuilder()
            .setTitle('🎫 System Ticketów')
            .setDescription('Kliknij przycisk poniżej, aby stworzyć ticket i skontaktować się z administracją.')
            .setColor('#0099ff')
            .setFooter({ text: 'Bot Serwera' });

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('📩 Stwórz Ticket')
                    .setStyle(ButtonStyle.Primary)
            );

        await kanal.send({ embeds: [embed], components: [button] });
        await interaction.reply({ content: '✅ Panel ticketów został ustawiony!', flags: MessageFlags.Ephemeral });
    }

    // KOMENDA: /konkurs
    if (commandName === 'konkurs') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral });
        }

        const tytul = interaction.options.getString('tytuł');
        const opis = interaction.options.getString('opis');
        const nagroda = interaction.options.getString('nagroda');
        const czas = interaction.options.getInteger('czas');

        const endTime = Date.now() + (czas * 60000);

        const embed = new EmbedBuilder()
            .setTitle(`🎉 ${tytul}`)
            .setDescription(opis)
            .addFields(
                { name: '🎁 Nagroda', value: nagroda },
                { name: '⏰ Koniec', value: `<t:${Math.floor(endTime / 1000)}:R>` },
                { name: '👥 Uczestnicy', value: '0' }
            )
            .setColor('#FFD700')
            .setTimestamp();

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('join_competition')
                    .setLabel('🎉 Weź udział')
                    .setStyle(ButtonStyle.Success)
            );

        const msg = await interaction.channel.send({ embeds: [embed], components: [button] });
        
        competitions.set(msg.id, {
            participants: [],
            endTime: endTime,
            title: tytul,
            prize: nagroda,
            description: opis
        });

        setTimeout(() => endCompetition(msg), czas * 60000);

        await interaction.reply({ content: '✅ Konkurs został utworzony!', flags: MessageFlags.Ephemeral });
    }

    // KOMENDA: /ankieta
    if (commandName === 'ankieta') {
        const pytanie = interaction.options.getString('pytanie');
        const opcje = [
            interaction.options.getString('opcja1'),
            interaction.options.getString('opcja2'),
            interaction.options.getString('opcja3'),
            interaction.options.getString('opcja4')
        ].filter(o => o !== null);

        const embed = new EmbedBuilder()
            .setTitle('📊 Ankieta')
            .setDescription(pytanie)
            .setColor('#9B59B6')
            .setTimestamp();

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        opcje.forEach((opcja, i) => {
            embed.addFields({ name: `${emojis[i]} ${opcja}`, value: '0 głosów (0%)', inline: false });
        });

        const msg = await interaction.channel.send({ embeds: [embed] });

        polls.set(msg.id, {
            options: opcje,
            votes: opcje.map(() => [])
        });

        for (let i = 0; i < opcje.length; i++) {
            await msg.react(emojis[i]);
        }

        await interaction.reply({ content: '✅ Ankieta została utworzona!', flags: MessageFlags.Ephemeral });
    }

    // KOMENDA: /faq
    if (commandName === 'faq') {
        if (faqData.size === 0) {
            return interaction.reply({ content: '❌ FAQ jest puste!', flags: MessageFlags.Ephemeral });
        }

        const targetChannel = interaction.options.getChannel('kanał');

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: '❌ Wskaż tekstowy kanał na serwerze!', flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle('❓ FAQ - Najczęściej Zadawane Pytania')
            .setColor('#3498db')
            .setTimestamp();

        faqData.forEach((data, id) => {
            embed.addFields({ name: `${id}. ${data.pytanie}`, value: data.odpowiedz, inline: false });
        });

        await targetChannel.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ FAQ wysłane na kanał ${targetChannel}`, flags: MessageFlags.Ephemeral });
    }

    // KOMENDA: /rekrutacja-setup
    if (commandName === 'rekrutacja-setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral });
        }

        const kanal = interaction.options.getChannel('kanał');

        const embed = new EmbedBuilder()
            .setTitle('🎯 Rekrutacja')
            .setDescription('**Dołącz do naszego zespołu!**\n\nWybierz stanowisko, na które chcesz aplikować używając menu poniżej.')
            .setColor('#E74C3C')
            .addFields(
                { name: '🛡️ Helper', value: 'Pomagaj graczom i dbaj o porządek na serwerze', inline: false },
                { name: '🏗️ Budowniczy', value: 'Twórz niesamowite budowle na serwerze', inline: false },
                { name: '🎉 Event Manager', value: 'Organizuj eventy i konkursy dla graczy', inline: false }
            )
            .setFooter({ text: 'Powodzenia!' });

        const selectMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('recruitment_select')
                    .setPlaceholder('Wybierz stanowisko')
                    .addOptions([
                        {
                            label: 'Helper',
                            description: 'Aplikuj na stanowisko Helpera',
                            value: 'helper',
                            emoji: '🛡️'
                        },
                        {
                            label: 'Budowniczy',
                            description: 'Aplikuj na stanowisko Budowniczego',
                            value: 'builder',
                            emoji: '🏗️'
                        },
                        {
                            label: 'Event Manager',
                            description: 'Aplikuj na stanowisko Event Managera',
                            value: 'event_manager',
                            emoji: '🎉'
                        }
                    ])
            );

        await kanal.send({ embeds: [embed], components: [selectMenu] });
        await interaction.reply({ content: '✅ Panel rekrutacji został ustawiony!', flags: MessageFlags.Ephemeral });
    }

    // KOMENDA: /weryfikacja-setup
    if (commandName === 'weryfikacja-setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral });
        }

        const kanal = interaction.options.getChannel('kanał');

        const embed = new EmbedBuilder()
            .setTitle('✅ Weryfikacja')
            .setDescription('Kliknij przycisk poniżej, aby zweryfikować się na serwerze!')
            .setColor('#2ECC71')
            .setFooter({ text: 'Bot Serwera' });

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_button')
                    .setLabel('✅ Zweryfikuj się')
                    .setStyle(ButtonStyle.Success)
            );

        await kanal.send({ embeds: [embed], components: [button] });
        await interaction.reply({ content: '✅ Panel weryfikacji został ustawiony!', flags: MessageFlags.Ephemeral });
    }

    // KOMENDA: /minecraft-status
    if (commandName === 'minecraft-status') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral });
        }

        const kanal = interaction.options.getChannel('kanał');
        minecraftStatusChannel = kanal;

        const embed = new EmbedBuilder()
            .setTitle('🎮 Status Serwera Minecraft')
            .setDescription('⏳ Sprawdzanie...')
            .setColor('#00FF00')
            .setTimestamp();

        minecraftStatusMessage = await kanal.send({ embeds: [embed] });
        
        updateMinecraftStatus();
        setInterval(updateMinecraftStatus, 30000);

        await interaction.reply({ content: '✅ Status Minecraft został ustawiony!', flags: MessageFlags.Ephemeral });
    }
});

// ==================== PRZYCISKI I INTERAKCJE ====================
client.on('interactionCreate', async interaction => {
    // OBSŁUGA SELECT MENU
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'recruitment_select') {
            const position = interaction.values[0];
            const positionNames = {
                'helper': 'Helper',
                'builder': 'Budowniczy',
                'event_manager': 'Event Manager'
            };

            const modal = new ModalBuilder()
                .setCustomId(`recruitment_modal_${position}`)
                .setTitle(`🎯 Rekrutacja: ${positionNames[position]}`);

            // ========== FORMULARZ DLA HELPERA ==========
            if (position === 'helper') {
                const ageInput = new TextInputBuilder()
                    .setCustomId('age')
                    .setLabel('1. Ile masz lat?')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Mam ...')
                    .setRequired(true)
                    .setMaxLength(50);

                const experienceInput = new TextInputBuilder()
                    .setCustomId('experience')
                    .setLabel('2. Doświadczenie jako Helper?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Opisz swoje doświadczenie...')
                    .setRequired(true)
                    .setMaxLength(4000);

                const microphoneInput = new TextInputBuilder()
                    .setCustomId('microphone')
                    .setLabel('3. Posiadasz mikrofon?')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Tak/Nie')
                    .setRequired(true)
                    .setMaxLength(100);

                const situationInput = new TextInputBuilder()
                    .setCustomId('situation')
                    .setLabel('4. Jak pomógłbyś graczowi który...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('...nie wie jak zacząć?')
                    .setRequired(true)
                    .setMaxLength(4000);

                const firstRow = new ActionRowBuilder().addComponents(ageInput);
                const secondRow = new ActionRowBuilder().addComponents(experienceInput);
                const thirdRow = new ActionRowBuilder().addComponents(microphoneInput);
                const fourthRow = new ActionRowBuilder().addComponents(situationInput);

                modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
            }

            // ========== FORMULARZ DLA BUDOWNICZEGO ==========
            else if (position === 'builder') {
                const ageInput = new TextInputBuilder()
                    .setCustomId('age')
                    .setLabel('1. Ile masz lat?')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Mam ...')
                    .setRequired(true)
                    .setMaxLength(50);

                const portfolioInput = new TextInputBuilder()
                    .setCustomId('portfolio')
                    .setLabel('2. Portfolio (linki do budowli/screeny)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Wklej linki do Imgur, Behance itp...')
                    .setRequired(true)
                    .setMaxLength(4000);

                const styleInput = new TextInputBuilder()
                    .setCustomId('style')
                    .setLabel('3. Jaki styl budownictwa preferujesz?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Średniowieczny, Nowoczesny, Fantasy...')
                    .setRequired(true)
                    .setMaxLength(4000);

                const timeInput = new TextInputBuilder()
                    .setCustomId('time')
                    .setLabel('4. Ile czasu możesz poświęcić?')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('np. 3-4 godziny dziennie')
                    .setRequired(true)
                    .setMaxLength(100);

                const firstRow = new ActionRowBuilder().addComponents(ageInput);
                const secondRow = new ActionRowBuilder().addComponents(portfolioInput);
                const thirdRow = new ActionRowBuilder().addComponents(styleInput);
                const fourthRow = new ActionRowBuilder().addComponents(timeInput);

                modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
            }

            // ========== FORMULARZ DLA EVENT MANAGERA ==========
            else if (position === 'event_manager') {
                const ageInput = new TextInputBuilder()
                    .setCustomId('age')
                    .setLabel('1. Ile masz lat?')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Mam ...')
                    .setRequired(true)
                    .setMaxLength(50);

                const experienceInput = new TextInputBuilder()
                    .setCustomId('experience')
                    .setLabel('2. Doświadczenie w organizacji eventów?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Opisz swoje doświadczenie...')
                    .setRequired(true)
                    .setMaxLength(4000);

                const ideasInput = new TextInputBuilder()
                    .setCustomId('ideas')
                    .setLabel('3. Pomysły na eventy dla serwera?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Wymień 2-3 pomysły na eventy...')
                    .setRequired(true)
                    .setMaxLength(4000);

                const availabilityInput = new TextInputBuilder()
                    .setCustomId('availability')
                    .setLabel('4. Twoja dostępność?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Dni tygodnia i godziny...')
                    .setRequired(true)
                    .setMaxLength(4000);

                const firstRow = new ActionRowBuilder().addComponents(ageInput);
                const secondRow = new ActionRowBuilder().addComponents(experienceInput);
                const thirdRow = new ActionRowBuilder().addComponents(ideasInput);
                const fourthRow = new ActionRowBuilder().addComponents(availabilityInput);

                modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
            }

            await interaction.showModal(modal);
        }
    }
    // OBSŁUGA MODALA
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('recruitment_modal_')) {
            const position = interaction.customId.replace('recruitment_modal_', '');
            const positionNames = {
                'helper': 'Helper',
                'builder': 'Budowniczy',
                'event_manager': 'Event Manager'
            };
            const positionEmojis = {
                'helper': '🛡️',
                'builder': '🏗️',
                'event_manager': '🎉'
            };

            const age = interaction.fields.getTextInputValue('age');
            const applicationsChannel = await client.channels.fetch(CONFIG.RECRUITMENT.APPLICATIONS_CHANNEL);

            const embed = new EmbedBuilder()
                .setTitle(`${positionEmojis[position]} Nowe podanie: ${positionNames[position]}`)
                .setDescription(`**Aplikant:** ${interaction.user} (${interaction.user.tag})`)
                .setColor('#E74C3C')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `ID: ${interaction.user.id}` });

            // ========== RÓŻNE POLA DLA RÓŻNYCH RANG ==========
            if (position === 'helper') {
                const experience = interaction.fields.getTextInputValue('experience');
                const microphone = interaction.fields.getTextInputValue('microphone');
                const situation = interaction.fields.getTextInputValue('situation');

                embed.addFields(
                    { name: '1️⃣ Wiek', value: age, inline: false },
                    { name: '2️⃣ Doświadczenie jako Helper', value: experience, inline: false },
                    { name: '3️⃣ Mikrofon', value: microphone, inline: false },
                    { name: '4️⃣ Przykładowa sytuacja', value: situation, inline: false }
                );

                applications.set(interaction.user.id, {
                    position: positionNames[position],
                    age,
                    experience,
                    microphone,
                    situation,
                    timestamp: Date.now()
                });
            }
            else if (position === 'builder') {
                const portfolio = interaction.fields.getTextInputValue('portfolio');
                const style = interaction.fields.getTextInputValue('style');
                const time = interaction.fields.getTextInputValue('time');

                embed.addFields(
                    { name: '1️⃣ Wiek', value: age, inline: false },
                    { name: '2️⃣ Portfolio', value: portfolio, inline: false },
                    { name: '3️⃣ Styl budownictwa', value: style, inline: false },
                    { name: '4️⃣ Dostępność czasowa', value: time, inline: false }
                );

                applications.set(interaction.user.id, {
                    position: positionNames[position],
                    age,
                    portfolio,
                    style,
                    time,
                    timestamp: Date.now()
                });
            }
            else if (position === 'event_manager') {
                const experience = interaction.fields.getTextInputValue('experience');
                const ideas = interaction.fields.getTextInputValue('ideas');
                const availability = interaction.fields.getTextInputValue('availability');

                embed.addFields(
                    { name: '1️⃣ Wiek', value: age, inline: false },
                    { name: '2️⃣ Doświadczenie z eventami', value: experience, inline: false },
                    { name: '3️⃣ Pomysły na eventy', value: ideas, inline: false },
                    { name: '4️⃣ Dostępność', value: availability, inline: false }
                );

                applications.set(interaction.user.id, {
                    position: positionNames[position],
                    age,
                    experience,
                    ideas,
                    availability,
                    timestamp: Date.now()
                });
            }

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_${interaction.user.id}_${position}`)
                        .setLabel('✅ Tak')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_${interaction.user.id}_${position}`)
                        .setLabel('❌ Nie')
                        .setStyle(ButtonStyle.Danger)
                );

            await applicationsChannel.send({ embeds: [embed], components: [buttons] });

            await interaction.reply({ 
                content: '✅ Twoje podanie zostało wysłane! Poczekaj na decyzję administracji.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    }

    if (!interaction.isButton()) return;

    // PRZYCISK: Stwórz Ticket
    if (interaction.customId === 'create_ticket') {
        const existingTicket = interaction.guild.channels.cache.find(
            ch => ch.name === `ticket-${interaction.user.username.toLowerCase()}`
        );

        if (existingTicket) {
            return interaction.reply({ 
                content: '❌ Masz już otwarty ticket!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const category = interaction.guild.channels.cache.get(CONFIG.TICKET_CATEGORY_ID);

        if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.reply({
                content: '❌ Kategoria ticketów nie została poprawnie skonfigurowana!',
                flags: MessageFlags.Ephemeral
            });
        }

        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket')
            .setDescription(`Witaj ${interaction.user}!\nOpisz swój problem, a administracja wkrótce się z Tobą skontaktuje.`)
            .setColor('#0099ff')
            .setTimestamp();

        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Zamknij Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        await ticketChannel.send({ embeds: [embed], components: [closeButton] });
        await interaction.reply({ content: `✅ Ticket został utworzony: ${ticketChannel}`, flags: MessageFlags.Ephemeral });

        tickets.set(ticketChannel.id, interaction.user.id);
    }

    // PRZYCISK: Zamknij Ticket
    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Zamykanie ticketu...');
        setTimeout(() => interaction.channel.delete(), 3000);
        tickets.delete(interaction.channel.id);
    }

    // PRZYCISK: Weź udział w konkursie
    if (interaction.customId === 'join_competition') {
        const competition = competitions.get(interaction.message.id);
        
        if (!competition) {
            return interaction.reply({ content: '❌ Konkurs nie istnieje!', flags: MessageFlags.Ephemeral });
        }

        if (competition.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ Już bierzesz udział!', flags: MessageFlags.Ephemeral });
        }

        competition.participants.push(interaction.user.id);

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.spliceFields(2, 1, { name: '👥 Uczestnicy', value: `${competition.participants.length}` });

        await interaction.message.edit({ embeds: [embed] });
        await interaction.reply({ content: '✅ Dołączyłeś do konkursu!', flags: MessageFlags.Ephemeral });
    }

    // PRZYCISK: Weryfikacja
    if (interaction.customId === 'verify_button') {
        const role = interaction.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
        
        if (!role) {
            return interaction.reply({ content: '❌ Rola weryfikacyjna nie została skonfigurowana!', flags: MessageFlags.Ephemeral });
        }

        if (interaction.member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Jesteś już zweryfikowany!', flags: MessageFlags.Ephemeral });
        }

        await interaction.member.roles.add(role);
        await interaction.reply({ content: '✅ Zostałeś zweryfikowany!', flags: MessageFlags.Ephemeral });
    }

    // PRZYCISKI: Akceptacja/Odrzucenie podania
    if (interaction.customId.startsWith('accept_') || interaction.customId.startsWith('reject_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral });
        }

        const parts = interaction.customId.split('_');
        const action = parts[0];
        const userId = parts[1];
        const position = parts[2];

        const positionNames = {
            'helper': 'Helper',
            'builder': 'Budowniczy',
            'event_manager': 'Event Manager'
        };

        const user = await client.users.fetch(userId);
        const resultsChannel = await client.channels.fetch(CONFIG.RECRUITMENT.RESULTS_CHANNEL);

        if (action === 'accept') {
            // Wiadomość na kanał wyników
            const resultEmbed = new EmbedBuilder()
                .setTitle('✅ Podanie Zaakceptowane')
                .setDescription(`**${user.tag}** został przyjęty na stanowisko **${positionNames[position]}**!`)
                .setColor('#2ECC71')
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `Zaakceptowane przez ${interaction.user.tag}` });

            await resultsChannel.send({ embeds: [resultEmbed] });

            // Wiadomość prywatna do użytkownika
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🎉 Gratulacje!')
                    .setDescription(`Twoje podanie na stanowisko **${positionNames[position]}** zostało **zaakceptowane**!\n\nWkrótce skontaktuje się z Tobą administracja.`)
                    .setColor('#2ECC71')
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Nie można wysłać wiadomości prywatnej do użytkownika');
            }

            await interaction.reply({ content: `✅ Zaakceptowano podanie użytkownika ${user.tag}`, flags: MessageFlags.Ephemeral });

        } else if (action === 'reject') {
            // Wiadomość na kanał wyników
            const resultEmbed = new EmbedBuilder()
                .setTitle('❌ Podanie Odrzucone')
                .setDescription(`Podanie użytkownika **${user.tag}** na stanowisko **${positionNames[position]}** zostało odrzucone.`)
                .setColor('#E74C3C')
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `Odrzucone przez ${interaction.user.tag}` });

            await resultsChannel.send({ embeds: [resultEmbed] });

            // Wiadomość prywatna do użytkownika
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('❌ Przykro nam')
                    .setDescription(`Twoje podanie na stanowisko **${positionNames[position]}** zostało **odrzucone**.\n\nMożesz spróbować ponownie później.`)
                    .setColor('#E74C3C')
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Nie można wysłać wiadomości prywatnej do użytkownika');
            }

            await interaction.reply({ content: `❌ Odrzucono podanie użytkownika ${user.tag}`, flags: MessageFlags.Ephemeral });
        }

        // Usuń przyciski z oryginalnej wiadomości
        await interaction.message.edit({ components: [] });
        applications.delete(userId);
    }
});

// ==================== REAKCJE NA ANKIETY ====================
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const poll = polls.get(reaction.message.id);
    if (!poll) return;

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const index = emojis.indexOf(reaction.emoji.name);
    
    if (index === -1) return;

    poll.votes[index].push(user.id);
    updatePollEmbed(reaction.message, poll);
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const poll = polls.get(reaction.message.id);
    if (!poll) return;

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const index = emojis.indexOf(reaction.emoji.name);
    
    if (index === -1) return;

    poll.votes[index] = poll.votes[index].filter(id => id !== user.id);
    updatePollEmbed(reaction.message, poll);
});

// ==================== POWIADOMIENIA O WEJŚCIU/WYJŚCIU ====================
client.on(Events.GuildMemberAdd, async (member) => {
    const logChannel = member.guild.channels.cache.get(CONFIG.MEMBER_LOG_CHANNEL_ID);
    if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
        .setTitle('🟢 Nowy gracz dołączył')
        .setDescription(`${member} dołączył do serwera.`)
        .addFields({ name: 'ID użytkownika', value: member.id })
        .setThumbnail(member.user.displayAvatarURL())
        .setColor('#2ecc71')
        .setTimestamp();

    await logChannel.send({ embeds: [embed] });
});

client.on(Events.GuildMemberRemove, async (member) => {
    const logChannel = member.guild.channels.cache.get(CONFIG.MEMBER_LOG_CHANNEL_ID);
    if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
        .setTitle('🔴 Gracz opuścił serwer')
        .setDescription(`${member.user.tag} opuścił serwer.`)
        .addFields({ name: 'ID użytkownika', value: member.id })
        .setThumbnail(member.user.displayAvatarURL())
        .setColor('#e74c3c')
        .setTimestamp();

    await logChannel.send({ embeds: [embed] });
});

function updatePollEmbed(message, poll) {
    const totalVotes = poll.votes.reduce((sum, votes) => sum + votes.length, 0);
    const embed = EmbedBuilder.from(message.embeds[0]);
    
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    
    embed.data.fields = poll.options.map((option, i) => {
        const votes = poll.votes[i].length;
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        return {
            name: `${emojis[i]} ${option}`,
            value: `${votes} głosów (${percentage}%)`,
            inline: false
        };
    });

    message.edit({ embeds: [embed] });
}

// ==================== KONIEC KONKURSU ====================
async function endCompetition(message) {
    const competition = competitions.get(message.id);
    if (!competition) return;

    const embed = new EmbedBuilder()
        .setTitle(`🎉 Konkurs zakończony: ${competition.title}`)
        .setColor('#E74C3C')
        .setTimestamp();

    const fields = [
        { name: '🎁 Nagroda', value: competition.prize, inline: false }
    ];

    if (!competition.description) {
        competition.description = '';
    }

    if (competition.participants.length === 0) {
        embed.setDescription(`${competition.description}\n\n⚠️ Konkurs zakończył się bez zwycięzcy.`.trim());
        fields.push(
            { name: '🏁 Zakończono', value: 'Brak uczestników – konkurs anulowany.', inline: false },
            { name: '👥 Uczestnicy', value: '0', inline: false }
        );

        await message.edit({ embeds: [embed.setFields(fields)], components: [] });
        await message.channel.send({ content: `⚠️ Konkurs **${competition.title}** zakończył się bez zwycięzcy.` });
        competitions.delete(message.id);
        return;
    }

    const winnerId = competition.participants[Math.floor(Math.random() * competition.participants.length)];
    const winnerUser = await client.users.fetch(winnerId);
    const timestamp = Math.floor(Date.now() / 1000);

    embed.setDescription(`${competition.description}\n\n🏆 **Zwycięzca:** ${winnerUser}`.trim());

    fields.push(
        { name: '🏁 Zakończono', value: `<t:${timestamp}:f>`, inline: false },
        { name: '🏆 Zwycięzca', value: `${winnerUser}`, inline: false },
        { name: '👥 Uczestnicy', value: `${competition.participants.length}`, inline: false }
    );

    await message.edit({ embeds: [embed.setFields(fields)], components: [] });
    await message.channel.send({ content: `🎉 Gratulacje ${winnerUser}! Wygrałeś konkurs **${competition.title}**.` });

    competitions.delete(message.id);
}

// ==================== STATUS MINECRAFT ====================
async function updateMinecraftStatus() {
    if (!minecraftStatusMessage) return;

    try {
        const response = await axios.get(`https://api.mcsrvstat.us/2/${CONFIG.MINECRAFT_SERVER}`);
        const data = response.data;

        const embed = new EmbedBuilder()
            .setTitle('🎮 Status Serwera Minecraft')
            .setColor(data.online ? '#00FF00' : '#FF0000')
            .setTimestamp();

        if (data.online) {
            embed.setDescription(`**🟢 Serwer jest ONLINE**`)
                .addFields(
                    { name: '👥 Gracze', value: `${data.players.online}/${data.players.max}`, inline: true },
                    { name: '📡 IP', value: CONFIG.MINECRAFT_SERVER, inline: true },
                    { name: '🔢 Wersja', value: '1.21.8', inline: true }
                );
        } else {
            embed.setDescription('**🔴 Serwer jest OFFLINE**');
        }

        await minecraftStatusMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error('Błąd podczas sprawdzania statusu Minecraft:', error);
    }
};

// ==================== LOGOWANIE ====================
client.login(CONFIG.TOKEN);