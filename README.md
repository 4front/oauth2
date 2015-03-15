# 4front-oauth2

OAuth2 plugin for 4front multi-tenant platform. Internally wraps the [passport-oauth2](https://github.com/jaredhanson/passport-oauth2) module.

## Installation

In the plugins directory of your 4front instance, simply run:

~~~
npm install 4front-oauth2
~~~

## Usage
Declare the plugin in the `router` array of your `_virtualApp` section in the package.json manifest.

~~~js
{
  "module": "plugin:4front-oauth2",
  "options": {
    "failureRedirect": "/login"
    "providers": [
      "github": {
        "scope": "user:email",
        "clientID": "${GITHUB_OAUTH_CLIENT_ID}",
        "clientSecret": "${GITHUB_OAUTH_CLIENT_SECRET}",
        "hostedDomain": ""
      }
    ]
  }
}
~~~

## Google Apps Domains
If you are using the Google OAuth provider and your app's users all belong to a Google Apps domain, you can restrict logins to only users whose email is associated with a specified domain. This is a great way to lock down the app to only employees.

~~~js
"providers": [
  "google": {
    "scope": "user:email",
    "clientID": "${GITHUB_OAUTH_CLIENT_ID}",
    "clientSecret": "${GITHUB_OAUTH_CLIENT_SECRET}",
    "hostedDomain": "mycompany.com"
  }
]
~~~

