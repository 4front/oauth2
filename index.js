var _ = require('lodash');
var shortid = require('shortid');
var debug = require('debug')('4front:oauth');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2').Strategy;
var knownProviders = require('./lib/providers');

require('simple-errors');

module.exports = function(options) {
  options = _.defaults(options || {}, {
    authPathPrefix: '/auth',
    failureRedirect: null,
    successRedirect: '/',
    returnUrlCookie: 'returnUrl',
    providers: [] // list of supported oauth providers that users can login to this app with
  });

  if (!_.isArray(options.providers) || options.providers.length === 0)
    throw new Error("At least one valid provider must be specified");

  return function(req, res, next) {
    debug("middleware");

    // If the req path doesn't start with /auth, this middleware doesn't apply
    if (req.path.slice(0, options.authPathPrefix.length) !== options.authPath)
      return next();

    var handler;
    var pathParts = req.path.split('/');
    var providerName, isCallback = false;

    if (pathParts.length === 3) // ex: /auth/facebook
      providerName = pathParts[2];
    else if (pathParts.length === 4 && pathParts[3] === 'callback') { // ex: /auth/facebook/callback
      providerName = pathParts[2];
      isCallback = true;
    }
    else
      return next(Error.http(404, "Invalid oauth URL"));

    // Make sure the providerName appears in the set of configured providers
    var provider = options[providerName];
    if (!provider) {
      return next(Error.http(404, "OAuth provider " + providerName + " not specified in options.providers."));
    }

    if (!req.session) {
      return next(Error.create("The oauth2 middleware requires that req.session be defined.", 
        { help: "Is the express-session middleware registered?"}));
    }

    req.ext.requestHandler = 'oauth2';

    // Allow req.ext.env to override process.env as the source of environment variables.
    var env;
    if (_.isObject(req.ext) && _.isObject(req.ext.env))
      env = req.ext.env;
    else
      env = process.env;

    // Expand environment variables in the options
    var passportOptions = {};
    _.each(provider, function(value, key) {
      passportOptions[key] = _.template(value)(env);
    });

    // If this provider is in the set of known providers, then default any missing values.
    // This avoids having to pass in authorizationURL and tokenURL for common providers
    // like Facebook, Twitter, and GitHub
    if (knownProviders[providerName]) {
      _.defaults(passportOptions, knownProviders[providerName]);
    }

    _.extend(passportOptions, {
      callbackURL: (req.secure ? 'https' : 'http') + '://' + req.hostname + options.authPath + '/' + providerName + '/callback'
    });

    // Generate a one-time strategy code that is unique to this instance.
    var oneTimeStrategyCode = shortid.generate();

    onFinished(res, function() {
      // Delete the temporary Passport strategy used for this request.
      debug("unuse passport strategy %s", oneTimeStrategyCode);
      passport.unuse(oneTimeStrategyCode);
    });

    var strategy = new OAuth2Strategy(providerOptions, function(accessToken, refreshToken, profile, done) {
      // Tack the accessToken on the user
      // TODO: do something with the _raw and _profile attributes, try to normalize the user object across providers
      var user = _.extend(profile, {
        accessToken: accessToken,
        provider: providerName
      });

      debug("user authenticated by %s", providerName);
      req.session.user = user;
      done(null, user);
    });

    passport.use(oneTimeStrategyCode, strategy);

    if (isCallback === false) {
      passport.authenticate(oneTimeStrategyCode, providerOptions, function(err) {
        if (err)
          return next(Error.http(401, 'Login to ' + providerName + ' failed', {}, err));
        else
          next();
      })(req, res, next);
    }
    else {
      if (req.query.error)
        return next(Error.http(401, req.query.error));

      return passport.authorize(oneTimeStrategyCode, _.pick(options, 'failureRedirect'))(req, res, function(err) {
        if (err)
          return next(err);

        debug("oauth callback complete");

        // Redirect back to the main index page
        var redirectUrl;
        if (req.cookies && req.cookies[options.returnUrlCookie]) {
          res.clearCookie('returnUrl');
          redirectUrl = req.cookies[options.returnUrlCookie];
        }
        else
          redirectUrl = options.successRedirect;

        // Now that we've successfully authenticated, redirect to the right page
        res.redirect(returnUrl);
      });
    }
  };
}