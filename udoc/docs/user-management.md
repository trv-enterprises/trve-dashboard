---
sidebar_position: 17
---

# User Management

Manage user accounts from Manage Mode > Users. Requires the Manage capability.

## User List

The users page shows all accounts with:
- Name and email
- Capability tags (View, Design, Manage)
- Status (Active / Inactive)
- Last modified date

Search and filter by name, email, or capabilities.

## Creating a User

1. Click **Create**
2. Enter a unique name (required)
3. Enter an email (optional)
4. Select capabilities:
   - **View**: Always available — access to View Mode
   - **Design**: Access to Design Mode (create/edit components, connections, dashboards)
   - **Manage**: Access to Manage Mode (users, settings, device types)
5. Click **Save**

## Editing a User

Click a user row to open the detail page. You can modify:

- **Name**: Must be unique across all users
- **Email**: Optional contact information
- **Status**: Toggle between Active and Inactive. Inactive users cannot log in.
- **Capabilities**: Add or remove View, Design, Manage access

## Pseudo Users

The system seeds three built-in pseudo users on first run:
- **Admin** — Full access (View, Design, Manage)
- **Designer** — View and Design access
- **Support** — View access only

These can be modified but not deleted.

---
