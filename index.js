import express from 'express';
import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionsBitField, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} from 'discord.js';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Kuzii Bot aktif ve çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`[+] Web sunucusu ${PORT} portunda çalışıyor.`);
});

let config = {};
try {
  if (fs.existsSync('./config.json')) {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  }
} catch (err) {}

const TOKEN = process.env.TOKEN || config.token;
const CLIENT_ID = process.env.CLIENT_ID || config.clientId;
const SETTINGS_FILE = './guild-settings.json';

function getSettings(guildId) {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2));
    }
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return data[guildId] || { welcomeChannelId: null, supportRoleId: null, bannerUrl: null };
  } catch (err) {
    return { welcomeChannelId: null, supportRoleId: null, bannerUrl: null };
  }
}

function saveSettings(guildId, newSettings) {
  try {
    let data = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
    data[guildId] = { ...getSettings(guildId), ...newSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {}
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

const commands = [
  new SlashCommandBuilder()
    .setName('ayar')
    .setDescription('Sunucuya özel bot ayarlarını yapılandırır.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addChannelOption(option => 
      option.setName('hosgeldin-kanali').setDescription('Hoş geldin mesajı kanalı').setRequired(true))
    .addRoleOption(option => 
      option.setName('yetkili-rolu').setDescription('Ticket yetkili rolü').setRequired(true))
    .addStringOption(option => 
      option.setName('banner-url').setDescription('Ticket paneli görsel linki').setRequired(false)),

  new SlashCommandBuilder()
    .setName('ticket-kur')
    .setDescription('Destek panelini kurar.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`[+] ${client.user.tag} aktif!`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('[+] Komutlar yüklendi.');
  } catch (error) {
    console.error('Komut yükleme hatası:', error);
  }
});

client.on('guildMemberAdd', async (member) => {
  const settings = getSettings(member.guild.id);
  if (!settings.welcomeChannelId) return;

  const accountCreationDate = Math.floor(member.user.createdTimestamp / 1000);
  const joinDate = Math.floor(member.joinedTimestamp / 1000);
  const memberCount = member.guild.memberCount;

  const channelEmbed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('💛 Aramıza Hoş Geldin!')
    .setDescription(`Merhaba ${member}, **${member.guild.name}** ailesine katıldığın için teşekkürler!`)
    .addFields(
      { name: '• Hesap Oluşturma', value: `<t:${accountCreationDate}:R>`, inline: false },
      { name: '• Sunucuya Giriş', value: `<t:${joinDate}:R>`, inline: false },
      { name: '• Üye Sırası', value: `\`${memberCount}. Üye\``, inline: false }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
    .setFooter({ text: `${member.guild.name} • Kuzii Web`, iconURL: member.guild.iconURL() })
    .setTimestamp();

  const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannelId);
  if (welcomeChannel) {
    await welcomeChannel.send({ content: `${member}`, embeds: [channelEmbed] }).catch(() => {});
  }

  try {
    const dmChannel = await member.createDM();
    const dmEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('💛 Aramıza Hoş Geldin!')
      .setDescription(`Merhaba ${member}, **${member.guild.name}** ailesine katıldığın için teşekkürler!`)
      .addFields(
        { name: '• Hesap Oluşturma', value: `<t:${accountCreationDate}:R>`, inline: false },
        { name: '• Sunucuya Giriş', value: `<t:${joinDate}:R>`, inline: false },
        { name: '• Üye Sırası', value: `\`${memberCount}. Üye\``, inline: false },
        { name: '• Bot Sahibi', value: '[Kuzey (Profili Gör)](https://discord.com/users/755697900301975622)', inline: false }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setFooter({ text: `${member.guild.name} • Kuzii Web`, iconURL: member.guild.iconURL() })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Bot Sahibi')
        .setURL('https://discord.com/users/755697900301975622')
        .setEmoji('👑')
    );
    await dmChannel.send({ embeds: [dmEmbed], components: [row] });
  } catch (err) {}
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ayar') {
      const channel = interaction.options.getChannel('hosgeldin-kanali');
      const role = interaction.options.getRole('yetkili-rolu');
      const banner = interaction.options.getString('banner-url') || null;

      saveSettings(interaction.guild.id, {
        welcomeChannelId: channel.id,
        supportRoleId: role.id,
        bannerUrl: banner
      });

      return interaction.reply({ content: `✅ **${interaction.guild.name}** ayarları kaydedildi!`, ephemeral: true });
    }

    if (interaction.commandName === 'ticket-kur') {
      const settings = getSettings(interaction.guild.id);
      if (!settings.supportRoleId) {
        return interaction.reply({ content: '⚠️ Önce `/ayar` komutunu kullanmalısın!', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('Destek Sistemi')
        .setDescription(`**${interaction.guild.name} • Resmi Destek Merkezi**\n\n📌 **Destek Sistemi Hakkında:**\nAşağıdaki seçeneklerden uygun olanı seçerek hemen bir ticket açabilirsiniz.`);

      if (settings.bannerUrl) embed.setImage(settings.bannerUrl);
      embed.setFooter({ text: `${interaction.guild.name} | Ticket Sistemi`, iconURL: interaction.client.user.displayAvatarURL() });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_select')
          .setPlaceholder('Ticket Açmak İçin Kategori Seçiniz.')
          .addOptions([
            { label: 'Destek & Teknik', description: 'Teknik sorunlar için.', value: 'ticket_teknik', emoji: '🛠️' },
            { label: 'Şikayet', description: 'Şikayet bildirmek için.', value: 'ticket_sikayet', emoji: '🚨' },
            { label: 'Satın Alma', description: 'Ödeme konuları için.', value: 'ticket_odeme', emoji: '💳' },
            { label: 'Ortaklık', description: 'Ortaklık için.', value: 'ticket_ortak', emoji: '🤝' },
            { label: 'Diğer', description: 'Diğer konular için.', value: 'ticket_diger', emoji: '📁' }
          ])
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Destek paneli kuruldu!', ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const categoryVal = interaction.values[0];
    const guild = interaction.guild;
    const member = interaction.member;
    const settings = getSettings(guild.id);

    let categoryName = 'destek';
    if (categoryVal === 'ticket_teknik') categoryName = 'teknik';
    else if (categoryVal === 'ticket_sikayet') categoryName = 'sikayet';
    else if (categoryVal === 'ticket_odeme') categoryName = 'odeme';
    else if (categoryVal === 'ticket_ortak') categoryName = 'ortaklik';
    else if (categoryVal === 'ticket_diger') categoryName = 'diger';

    const safeUsername = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 5);
    const channelName = `ticket-${categoryName}-${safeUsername}`;

    const existingChannel = guild.channels.cache.find(c => c.name === channelName);
    if (existingChannel) {
      return interaction.reply({ content: `Zaten açık bir talebin var: ${existingChannel}`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: settings.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ]
      });

      const ticketEmbed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`Destek Talebi: ${categoryName.toUpperCase()}`)
        .setDescription(`Merhaba ${member}, destek talebin açıldı.`);

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Talebi Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      await ticketChannel.send({ content: `<@&${settings.supportRoleId}> | ${member}`, embeds: [ticketEmbed], components: [closeRow] });
      await interaction.editReply({ content: `Talep açıldı: ${ticketChannel}` });
    } catch (err) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Kanal açılırken hata oluştu!' }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ Kanal açılırken hata oluştu!', ephemeral: true }).catch(() => {});
      }
    }
  }

  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    const channel = interaction.channel;
    await interaction.reply({ content: '🔒 Talep kapatılıyor...', ephemeral: true });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
  }
});

client.login(TOKEN);