# Bot Discord

Bot Discord dla serwera Minecraft z systemem ticketów, rekrutacji, konkursów, ankiet i dodatkowymi funkcjami administracyjnymi.

## Wymagania

- Node.js w wersji `>=16.11.0`
- Konto Discord z uprawnieniami do tworzenia aplikacji i zarządzania serwerem

## Konfiguracja

1. Sklonuj repozytorium:

   ```bash
   git clone https://github.com/<twoje-konto>/<twoje-repo>.git
   cd <twoje-repo>
   ```

2. Zainstaluj zależności:

   ```bash
   npm install
   ```

3. Utwórz plik `.env` na podstawie `env.example`:

   ```bash
   cp env.example .env
   ```

4. Uzupełnij wartości w `.env` (token bota, identyfikatory kanałów i ról).

### Wymagane zmienne środowiskowe

- `DISCORD_TOKEN` – token bota z [Discord Developer Portal](https://discord.com/developers/applications)
- `DISCORD_CLIENT_ID` – identyfikator aplikacji (client ID)
- `DISCORD_GUILD_ID` – identyfikator serwera docelowego
- `VERIFIED_ROLE_ID` – identyfikator roli nadawanej po weryfikacji
- `RECRUITMENT_APPLICATIONS_CHANNEL` – kanał, w którym pojawiają się zgłoszenia
- `RECRUITMENT_RESULTS_CHANNEL` – kanał z wynikami rekrutacji
- `TICKET_CATEGORY_ID` – identyfikator kategorii, w której tworzone są tickety
- `MEMBER_LOG_CHANNEL_ID` – kanał powiadomień o dołączeniach i wyjściach graczy

Opcjonalnie możesz dostosować:

- `MINECRAFT_SERVER` (domyślnie `twoj-serwer.pl`)
- `MINECRAFT_PORT` (domyślnie `25565`)

## Uruchamianie

### Tryb produkcyjny

```bash
npm run start
```

### Tryb developerski (z auto-reload przez nodemon)

```bash
npm run dev
```

## Rejestrowanie komend

Skrypt podczas startu rejestruje komendy slash za pomocą REST API Discorda. Upewnij się, że bot ma uprawnienia do zarządzania komendami na serwerze (`applications.commands`).


## Licencja

Projekt jest udostępniony na licencji MIT. Szczegóły w pliku `LICENSE`

