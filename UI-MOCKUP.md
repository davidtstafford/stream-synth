# Stream Synth UI Mockup

## Application Window (1200x800)

The application features a dark theme with Twitch purple (#9147ff) accents:

### Layout Description

**Left Sidebar (200px wide)**
- Dark gray background (#252525)
- Menu item: "Connection" (active state)
  - Purple left border (3px)
  - Slightly lighter background (#2d2d2d)
- Hover effect: Background lightens on hover

**Main Content Area (Remaining width)**
- Dark background (#1a1a1a)
- White text on dark background

### Connection Screen

**Title Section**
- Large heading "Connection" (32px, bold)
- 30px spacing below

**Form Section**
- Label: "Twitch Client ID" (small, gray text)
- Input field:
  - Full width, max 400px
  - Dark gray background (#2d2d2d)
  - Light border (#444)
  - Purple border on focus (#9147ff)
  - Placeholder: "Enter your Twitch Client ID"

**Action Button**
- Purple button (#9147ff)
- Text: "Connect to Twitch"
- Hover effect: Darker purple (#7d3cdc)
- Disabled state: Gray (#555)

**Status Messages** (Appear after interaction)
Three types with colored backgrounds:
- Success: Green background with bright green text
  - Example: "Successfully authenticated with Twitch!"
- Error: Red background with bright red text
  - Example: "Authentication failed: [error message]"
- Info: Blue background with bright blue text
  - Example: "Opening Twitch authentication..."

**Token Display** (When connected)
- Label: "Access Token (truncated)"
- Semi-transparent input showing first 20 characters
- Read-only display

### Authentication Flow (Internal Window)

When "Connect to Twitch" is clicked:
1. New modal window opens (800x600)
2. Displays Twitch OAuth page
3. User enters credentials on Twitch's actual page
4. User authorizes the application
5. Window closes automatically on success
6. Main window shows success message

### WebSocket Connection Indicator

After successful authentication:
- Status message updates to show WebSocket connection
- Session ID displayed (truncated for security)
- Message: "WebSocket session established! Session ID: [first 8 chars]..."

## Color Palette

- Background: #1a1a1a (very dark gray)
- Sidebar: #252525 (dark gray)
- Hover/Active: #2d2d2d (medium dark gray)
- Accent: #9147ff (Twitch purple)
- Text: #ffffff (white)
- Secondary text: #b0b0b0 (light gray)
- Borders: #333/#444 (dark borders)

## Typography

- Font: System fonts (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- Title: 32px, bold
- Labels: 14px, lighter weight
- Inputs: 14px
- Buttons: 14px, medium weight

## Interaction States

1. **Initial State**: Empty input, enabled button
2. **Connecting**: Button shows "Connecting...", disabled
3. **Authenticated**: Input disabled, button changes to "Disconnect"
4. **Connected**: WebSocket status shows session info
5. **Error**: Red status message, button returns to initial state

This design provides a clean, professional interface consistent with modern desktop applications and Twitch's brand colors.
