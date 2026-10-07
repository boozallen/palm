# Configuring Keycloak

[Keycloak](https://www.keycloak.com) is a versatile open-source Identity and Access Management solution, designed for modern applications and services. It is self-hosted, offering extensive customization to meet various authentication requirements.

## Inheriting Session User Roles

PALM supports configuring user roles for a session by inheriting them from Keycloak. To achieve this, a users Keycloak profile must include a valid role. PALM will use the `INHERITED_OAUTH_ROLE_PATH` environment variable to search for this role within the OAuth Profile object.

**Note:** The role inherited from Keycloak does not persist in our database and only exists as part of the user's active session.

Here are the minimum steps required to integrate Keycloak roles with PALM:

### Configure User Profile in Keycloak

1. Select the relevant realm
2. Navigate to **Users** in the left-hand menu.
3. Click the **Add user** button in the upper right-hand corner.
4. Enter user details and click **Save**.
5. Within the user's page, select the **Attributes** tab.
6. Add an Attribute with a key of `role` and a value of `Admin`
    - PALM defaults an absent or invalid role to `User`; valid roles are `User` and `Admin`.
7. Click the **Add** button on the right-hand side and click **Save**.

### Create Client Scope for Role

1. Navigate to **Client Scopes** in the left-hand navigation menu.
2. Click the **Create** button in the upper right-hand corner.
3. Enter `role` as the **Name** and add a unique **Description**.
4. Click **Save**.

### Configure Mapper for the Client Scope

1. Within the page of your newly created client scope, select the **Mappers** tab and click **Create** in the upper right-hand corner.
2. Enter `role` for name and select `User Attribute` as the **Mapper Type**.
3. Enter `role` for the **User Attribute** and **Token Claim Name** fields.
4. Select `String` as the **Claim JSON Type** and click **Save**.

### Assign Client Scope to Client

1. Navigate to **Clients** using the left-hand menu.
2. Select the client created for PALM.
3. Within the client page, select the **Client Scopes** tab
4. Under **Default Client Scopes**, select the newly created `role` scope and click the **Add selected** button.

### Configure PALM to search for the role

1. In your local `.env.local` file, set `INHERITED_OAUTH_ROLE_PATH=role`
2. Recompose your frontend container by running `docker compose up -d frontend`

Now, when creating a user, you can assign them a role of either `User` or `Admin`. PALM will default an absent or invalid role to the role set for the User in the DB (which defaults to `User`), so you only need to explicitly set this field for users who need to be `Admin`.

## ENVIRONMENT: Local

Running `docker compose up -d` spins up a Keycloak container accessible at <http://localhost:8080>. This section guides you through the minimal setup necessary to integrate Keycloak with PALM.

1. Navigate to <http://localhost:8080>. Enter the **Administration Console**.
2. Sign in using the administrator account: **Username**=`admin` & **Password**=`admin`
3. At the top-left corner, hover over **Master** and click 'Add realm'.
    1. Provide a name, ensure 'Enabled' is `ON`, then click 'Create'.
    2. Set `KEYCLOAK_ISSUER` in your `.env.local` file to `http://keycloak:8080/realms/<realm-name>`, replacing `<realm-name>` with your new realm's name.
4. Notice your realm name is now in the top-left corner. Click on 'Clients' in the left-hand navigation menu under **Configure**.
    1. On the right hand side, click 'Create'.
    2. Enter a Client ID. This is the value set for the `KEYCLOAK_ID` in your `env.local`. Click 'Save'.
    3. For 'Access Type', select `confidential`. Ensure 'Standard Flow Enabled' and 'Direct Access Grants Enabled' are `ON`.
    4. Fill in `http://localhost:3000/*` for 'Valid Redirect URIs' and `http://localhost:3000` for 'Web Origins', then save.
5. The 'Credentials' tab should now appear up top. Select it and copy the 'Secret' to your `env.local` as the `KEYCLOAK_SECRET`.
6. Click on 'Users' in the left-hand navigation menu under **Manage**.
    1. Click 'Add user'.
    2. Fill in a 'Username' and click 'Save'.
    3. Select the 'Credentials' tab.
    4. Fill in a password for the user, toggle 'Temporary' to `OFF`, then click 'Set Password'. Confirm 'Set password' to the popup modal.
7. Verify in your `env.local` that `ENABLED_NEXTAUTH_PROVIDERS` includes `keycloak` and `KEYCLOAK_ID`, `KEYCLOAK_SECRET`, and `KEYCLOAK_ISSUER` are correctly set.
8. Reactivate the frontend container with:

    ```bash
    docker compose up -d frontend
    ```

9. To ensure that the browser correctly resolves the address `http://keycloak:8080` as `http://localhost:8080`, add a line to your `hosts` file:

    ```bash
    127.0.0.1   keycloak
    ```

    **Warning:**  Directly editing your `hosts` file should be done with caution to avoid disrupting existing configurations. **Always create a backup** before making changes.

    1. **macOS** - file is located at `/etc/hosts`
        1. **Note:** Modifying `/etc/hosts` usually requires superuser permissions. Therefore, you might need to prepend sudo to your command when editing this file, such as using `sudo nano /etc/hosts` or another text editor of your choice.
        2. **Create a backup:**  by executing:

        ```bash
        sudo cp /etc/hosts /etc/hosts.backup
        ```

    2. **Windows** - file is located at `C:\Windows\System32\drivers\etc\hosts`. To edit:
        1. Run **Notepad** as an administrator.
        2. Open the file listed above. It does not have an extension type, there may be a `hosts.ics` file which is the wrong one.
        3. Add the line to the file and save.

    This modification allows your system to map the `keycloak` hostname to your local machine, facilitating communication between your browser and the containerized Keycloak server.

Now, visit <http://localhost:3000> and select the "Sign in with Keycloak" option. You should now be able to log in using the credentials established earlier.

## ENVIRONMENT: Production

- Key aspects on the configurations needed to use Keycloak in production can be found in this guide: [https://www.keycloak.org/server/configuration-production](https://www.keycloak.org/server/configuration-production).
- A list of guides provided by Keycloak can be found here: [https://www.keycloak.org/guides](https://www.keycloak.org/guides)
- Finally, Keycloak's documentation can be found here [https://www.keycloak.org/documentation](https://www.keycloak.org/documentation).
