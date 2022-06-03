class Cookie {
  // KEYS
  static get DESCRIPTION() {
    return 'radar-description';
  }

  static get DEVICE_ID() {
    return 'radar-deviceId';
  }

  static get DEVICE_TYPE() {
    return 'radar-deviceType';
  }

  static get METADATA() {
    return 'radar-metadata';
  }

  static get HOST() {
    return 'radar-host';
  }

  static get PUBLISHABLE_KEY() {
    return 'radar-publishableKey';
  }

  static get USER_ID() {
    return 'radar-userId';
  }

  static get INSTALL_ID() {
    return 'radar-installId';
  }

  static get TRIP_OPTIONS() {
    return 'radar-trip-options';
  }

  static get CUSTOM_HEADERS() {
    return 'radar-custom-headers';
  }

  static get BASE_API_PATH() {
    return 'radar-base-api-path';
  } // parse cookie string to return value at {key}


  static getCookie(key) {
    if (!document || document.cookie === undefined) {
      return null;
    }

    const prefix = `${key}=`;
    const cookies = document.cookie.split(';');
    const value = cookies.find(cookie => cookie.indexOf(prefix) != -1);
    return value ? value.trim().substring(prefix.length) : null;
  } // set cookie using {key, value}


  static setCookie(key, value) {
    if (!document || !document.cookie === undefined || typeof value !== 'string') {
      return;
    }

    const date = new Date();
    date.setFullYear(date.getFullYear() + 10);
    const expires = `expires=${date.toGMTString()}`;
    const sameSite = 'samesite=strict';
    document.cookie = `${key}=${value};path=/;${sameSite};${expires}`;
  } // delete cookie with {key}


  static deleteCookie(key) {
    if (!document || !document.cookie) {
      return;
    }

    document.cookie = `${key}=;expires=Thu, 01-Jan-1970 00:00:01 GMT;path=/`;
  }

}

var STATUS = {
  SUCCESS: 'SUCCESS',
  ERROR_PUBLISHABLE_KEY: 'ERROR_PUBLISHABLE_KEY',
  ERROR_PERMISSIONS: 'ERROR_PERMISSIONS',
  ERROR_LOCATION: 'ERROR_LOCATION',
  ERROR_NETWORK: 'ERROR_NETWORK',
  ERROR_BAD_REQUEST: 'ERROR_BAD_REQUEST',
  ERROR_UNAUTHORIZED: 'ERROR_UNAUTHORIZED',
  ERROR_PAYMENT_REQUIRED: 'ERROR_PAYMENT_REQUIRED',
  ERROR_FORBIDDEN: 'ERROR_FORBIDDEN',
  ERROR_NOT_FOUND: 'ERROR_NOT_FOUND',
  ERROR_RATE_LIMIT: 'ERROR_RATE_LIMIT',
  ERROR_SERVER: 'ERROR_SERVER',
  ERROR_UNKNOWN: 'ERROR_UNKNOWN'
};

class Navigator {
  static getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator || !navigator.geolocation) {
        return reject(STATUS.ERROR_LOCATION);
      }

      navigator.geolocation.getCurrentPosition( // success callback
      position => {
        if (!position || !position.coords) {
          return reject(STATUS.ERROR_LOCATION);
        }

        const {
          latitude,
          longitude,
          accuracy
        } = position.coords;
        return resolve({
          latitude,
          longitude,
          accuracy
        });
      }, // error callback
      err => {
        if (err && err.code && err.code === 1) {
          return reject(STATUS.ERROR_PERMISSIONS);
        }

        return reject(STATUS.ERROR_LOCATION);
      });
    });
  }

}

const DEFAULT_HOST = 'https://api.radar.io';

class API_HOST {
  static getHost() {
    return Cookie.getCookie(Cookie.HOST) || DEFAULT_HOST;
  }

}

var SDK_VERSION = '3.2.1';

class Http {
  static request(method, path, data) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let url = `${API_HOST.getHost()}/${path}`; // remove undefined values

      let body = {};
      Object.keys(data).forEach(key => {
        const value = data[key];

        if (value !== undefined) {
          body[key] = value;
        }
      }); // convert data to querystring for GET

      if (method === 'GET') {
        const params = Object.keys(body).map(key => `${key}=${encodeURIComponent(body[key])}`);

        if (params.length > 0) {
          const queryString = params.join('&');
          url = `${url}?${queryString}`;
        }

        body = undefined; // dont send body for GET request
      }

      xhr.open(method, url, true);
      const publishableKey = Cookie.getCookie(Cookie.PUBLISHABLE_KEY);

      if (!publishableKey) {
        reject(STATUS.ERROR_PUBLISHABLE_KEY);
        return;
      } // set headers


      xhr.setRequestHeader('Authorization', publishableKey);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Radar-Device-Type', 'Web');
      xhr.setRequestHeader('X-Radar-SDK-Version', SDK_VERSION); // set custom headers if present

      const customHeaders = Cookie.getCookie(Cookie.CUSTOM_HEADERS);

      if (customHeaders) {
        const headers = JSON.parse(customHeaders);
        Object.keys(headers).forEach(header => {
          xhr.setRequestHeader(header, headers[header]);
        });
      }

      xhr.onload = () => {
        let response;

        try {
          response = JSON.parse(xhr.response);
        } catch (e) {
          reject(STATUS.ERROR_SERVER);
        }

        if (xhr.status == 200) {
          resolve(response);
        } else if (xhr.status === 400) {
          reject({
            httpError: STATUS.ERROR_BAD_REQUEST,
            response
          });
        } else if (xhr.status === 401) {
          reject({
            httpError: STATUS.ERROR_UNAUTHORIZED,
            response
          });
        } else if (xhr.status === 402) {
          reject({
            httpError: STATUS.ERROR_PAYMENT_REQUIRED,
            response
          });
        } else if (xhr.status === 403) {
          reject({
            httpError: STATUS.ERROR_FORBIDDEN,
            response
          });
        } else if (xhr.status === 404) {
          reject({
            httpError: STATUS.ERROR_NOT_FOUND,
            response
          });
        } else if (xhr.status === 429) {
          reject({
            httpError: STATUS.ERROR_RATE_LIMIT,
            response
          });
        } else if (500 <= xhr.status && xhr.status < 600) {
          reject({
            httpError: STATUS.ERROR_SERVER,
            response
          });
        } else {
          reject({
            httpError: STATUS.ERROR_UNKNOWN,
            response
          });
        }
      };

      xhr.onerror = function () {
        reject(STATUS.ERROR_SERVER);
      };

      xhr.timeout = function () {
        reject(STATUS.ERROR_NETWORK);
      };

      xhr.send(JSON.stringify(body));
    });
  }

}

class Context {
  static async getContext(location = {}) {
    if (!location.latitude || !location.longitude) {
      location = await Navigator.getCurrentPosition();
    }

    const {
      latitude,
      longitude
    } = location;
    const params = {
      coordinates: `${latitude},${longitude}`
    };
    return Http.request('GET', `v1/context`, params);
  }

}

class Geocoding {
  static async geocode(geocodeOptions = {}) {
    const {
      query,
      layers,
      country
    } = geocodeOptions;
    return Http.request('GET', 'v1/geocode/forward', {
      query,
      layers,
      country
    });
  }

  static async reverseGeocode(geocodeOptions = {}) {
    if (!geocodeOptions.latitude || !geocodeOptions.longitude) {
      const {
        latitude,
        longitude
      } = await Navigator.getCurrentPosition();
      geocodeOptions.latitude = latitude;
      geocodeOptions.longitude = longitude;
    }

    const {
      latitude,
      longitude,
      layers
    } = geocodeOptions;
    const params = {
      coordinates: `${latitude},${longitude}`,
      layers
    };
    return Http.request('GET', 'v1/geocode/reverse', params);
  }

  static async ipGeocode(geocodeOptions = {}) {
    const {
      ip
    } = geocodeOptions;
    return Http.request('GET', 'v1/geocode/ip', {
      ip
    });
  }

}

class Routing {
  static async getDistanceToDestination(routingOptions = {}) {
    if (!routingOptions.origin) {
      const {
        latitude,
        longitude
      } = await Navigator.getCurrentPosition();
      routingOptions.origin = {
        latitude,
        longitude
      };
    }

    let {
      origin,
      destination,
      modes,
      units,
      geometry
    } = routingOptions;
    origin = `${origin.latitude},${origin.longitude}`;

    if (destination) {
      destination = `${destination.latitude},${destination.longitude}`;
    }

    if (modes) {
      modes = modes.join(',');
    }

    const params = {
      origin,
      destination,
      modes,
      units,
      geometry
    };
    return Http.request('GET', 'v1/route/distance', params);
  }

  static async getMatrixDistances(routingOptions = {}) {
    if (!routingOptions.origins) {
      const {
        latitude,
        longitude
      } = await Navigator.getCurrentPosition();
      routingOptions.origins = [{
        latitude,
        longitude
      }];
    }

    let {
      origins,
      destinations,
      mode,
      units,
      geometry
    } = routingOptions;
    origins = (origins || []).map(origin => `${origin.latitude},${origin.longitude}`).join('|');
    destinations = (destinations || []).map(destination => `${destination.latitude},${destination.longitude}`).join('|');
    const params = {
      origins,
      destinations,
      mode,
      units,
      geometry
    };
    return Http.request('GET', 'v1/route/matrix', params);
  }

}

class Search {
  static async searchPlaces(searchOptions = {}) {
    if (!searchOptions.near) {
      const {
        latitude,
        longitude
      } = await Navigator.getCurrentPosition();
      searchOptions.near = {
        latitude,
        longitude
      };
    }

    let {
      near,
      radius,
      chains,
      categories,
      groups,
      limit
    } = searchOptions;
    near = `${near.latitude},${near.longitude}`;

    if (chains) {
      chains = chains.join(',');
    }

    if (categories) {
      categories = categories.join(',');
    }

    if (groups) {
      groups = groups.join(',');
    }

    const params = {
      near,
      radius,
      chains,
      categories,
      groups,
      limit
    };
    return Http.request('GET', 'v1/search/places', params);
  }

  static async searchGeofences(searchOptions = {}) {
    if (!searchOptions.near) {
      const {
        latitude,
        longitude
      } = await Navigator.getCurrentPosition();
      searchOptions.near = {
        latitude,
        longitude
      };
    }

    let {
      near,
      radius,
      tags,
      metadata,
      limit
    } = searchOptions;
    near = `${near.latitude},${near.longitude}`;

    if (tags) {
      tags = tags.join(',');
    }

    const params = {
      near,
      radius,
      tags,
      limit
    };

    if (metadata) {
      Object.keys(metadata).forEach(k => {
        const key = `metadata[${k}]`;
        const value = metadata[k];
        params[key] = value;
      });
    }

    return Http.request('GET', 'v1/search/geofences', params);
  }

  static async autocomplete(searchOptions = {}) {
    var _near, _near2;

    // if near is not provided, server will use geoIP as fallback
    let {
      query,
      near,
      limit,
      layers,
      country
    } = searchOptions;

    if (((_near = near) === null || _near === void 0 ? void 0 : _near.latitude) && ((_near2 = near) === null || _near2 === void 0 ? void 0 : _near2.longitude)) {
      near = `${near.latitude},${near.longitude}`;
    }

    const params = {
      query,
      near,
      limit,
      layers,
      country
    };
    return Http.request('GET', 'v1/search/autocomplete', params);
  }

}

const generateUUID = () => {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const r = Math.random() * 16 | 0;
    const v = char == 'x' ? r : r & 0x3 | 0x8;
    return v.toString(16);
  });
  return uuid;
};

class Device {
  static getId() {
    // use existing deviceId if present
    const deviceId = Cookie.getCookie(Cookie.DEVICE_ID);

    if (deviceId) {
      return deviceId;
    } // generate new deviceId


    const uuid = generateUUID();
    Cookie.setCookie(Cookie.DEVICE_ID, uuid);
    return uuid;
  }

}

class Track {
  static async trackOnce(params = {}) {
    let {
      latitude,
      longitude,
      accuracy
    } = params;

    if (!latitude || !longitude) {
      const deviceLocation = await Navigator.getCurrentPosition();
      latitude = deviceLocation.latitude;
      longitude = deviceLocation.longitude;
      accuracy = deviceLocation.accuracy;
    }

    const deviceId = Device.getId();
    const userId = Cookie.getCookie(Cookie.USER_ID);
    const installId = Cookie.getCookie(Cookie.INSTALL_ID) || deviceId;
    const deviceType = Cookie.getCookie(Cookie.DEVICE_TYPE) || 'Web';
    const description = Cookie.getCookie(Cookie.DESCRIPTION);
    let metadata = Cookie.getCookie(Cookie.METADATA);

    if (metadata) {
      metadata = JSON.parse(metadata);
    }

    let tripOptions = Cookie.getCookie(Cookie.TRIP_OPTIONS);

    if (tripOptions) {
      tripOptions = JSON.parse(tripOptions);
    }

    const body = { ...params,
      accuracy,
      description,
      deviceId,
      deviceType,
      foreground: true,
      installId,
      latitude,
      longitude,
      metadata,
      sdkVersion: SDK_VERSION,
      stopped: true,
      userId,
      tripOptions
    };
    const basePath = Cookie.getCookie(Cookie.BASE_API_PATH) || 'v1';
    const trackEndpoint = `${basePath}/track`;
    const response = await Http.request('POST', trackEndpoint, body);
    response.location = {
      latitude,
      longitude,
      accuracy
    };
    return response;
  }

}

class Trips {
  static async updateTrip(tripOptions = {}, status) {
    const {
      externalId,
      destinationGeofenceTag,
      destinationGeofenceExternalId,
      mode,
      metadata
    } = tripOptions;
    const params = {
      externalId,
      status,
      destinationGeofenceTag,
      destinationGeofenceExternalId,
      mode,
      metadata
    };
    const basePath = Cookie.getCookie(Cookie.BASE_API_PATH) || 'v1';
    return Http.request('PATCH', `${basePath}/trips/${externalId}`, params);
  }

}

const TRIP_STATUS = {
  STARTED: "started",
  APPROACHING: "approaching",
  ARRIVED: "arrived",
  COMPLETED: "completed",
  EXPIRED: "expired",
  CANCELED: "canceled",
  UNKNOWN: undefined
};

const defaultCallback = () => {};

const handleError = callback => {
  return err => {
    // Radar Error
    if (typeof err === 'string') {
      callback(err, {});
      return;
    } // Http Error


    if (typeof err === 'object' && err.httpError) {
      callback(err.httpError, {}, err.response);
      return;
    } // Unknown


    callback(STATUS.ERROR_UNKNOWN, {});
  };
};

class Radar {
  static get VERSION() {
    return SDK_VERSION;
  }

  static get STATUS() {
    return STATUS;
  }

  static initialize(publishableKey) {
    if (!publishableKey) {
      console.error('Radar "initialize" was called without a publishable key');
    }

    Cookie.setCookie(Cookie.PUBLISHABLE_KEY, publishableKey);
  }

  static setHost(host, baseApiPath) {
    Cookie.setCookie(Cookie.HOST, host, true);
    Cookie.setCookie(Cookie.BASE_API_PATH, baseApiPath);
  }

  static setUserId(userId) {
    if (!userId) {
      Cookie.deleteCookie(Cookie.USER_ID);
      return;
    }

    Cookie.setCookie(Cookie.USER_ID, String(userId).trim());
  }

  static setDeviceId(deviceId, installId) {
    if (deviceId) {
      Cookie.setCookie(Cookie.DEVICE_ID, String(deviceId).trim());
    } else {
      Cookie.deleteCookie(Cookie.DEVICE_ID);
    }

    if (installId) {
      Cookie.setCookie(Cookie.INSTALL_ID, String(installId).trim());
    } else {
      Cookie.deleteCookie(Cookie.INSTALL_ID);
    }
  }

  static setDescription(description) {
    if (!description) {
      Cookie.deleteCookie(Cookie.DESCRIPTION);
      return;
    }

    Cookie.setCookie(Cookie.DESCRIPTION, String(description).trim());
  }

  static setMetadata(metadata) {
    if (!metadata) {
      Cookie.deleteCookie(Cookie.METADATA);
      return;
    }

    Cookie.setCookie(Cookie.METADATA, JSON.stringify(metadata));
  }

  static setRequestHeaders(headers = {}) {
    if (!Object.keys(headers).length) {
      Cookie.deleteCookie(Cookie.CUSTOM_HEADERS);
      return;
    }

    Cookie.setCookie(Cookie.CUSTOM_HEADERS, JSON.stringify(headers));
  }

  static getLocation(callback = defaultCallback) {
    Navigator.getCurrentPosition().then(location => {
      callback(null, {
        location,
        status: STATUS.SUCCESS
      });
    }).catch(handleError(callback));
  }

  static trackOnce(arg0, arg1 = defaultCallback) {
    let callback;
    let location;

    if (typeof arg0 === 'function') {
      callback = arg0;
    } else {
      location = arg0;
      callback = arg1;
    }

    Track.trackOnce(location).then(response => {
      callback(null, {
        location: response.location,
        user: response.user,
        events: response.events,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static getContext(arg0, arg1 = defaultCallback) {
    let callback;
    let location;

    if (typeof arg0 === 'function') {
      callback = arg0;
    } else {
      location = arg0;
      callback = arg1;
    }

    Context.getContext(location).then(response => {
      callback(null, {
        context: response.context,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static startTrip(tripOptions, callback = defaultCallback) {
    Trips.updateTrip(tripOptions, TRIP_STATUS.STARTED).then(response => {
      Cookie.setCookie(Cookie.TRIP_OPTIONS, JSON.stringify(tripOptions));
      callback(null, {
        trip: response.trip,
        events: response.events,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static updateTrip(tripOptions, status, callback = defaultCallback) {
    Trips.updateTrip(tripOptions, status).then(response => {
      // set cookie
      Cookie.setCookie(Cookie.TRIP_OPTIONS, JSON.stringify(tripOptions));
      callback(null, {
        trip: response.trip,
        events: response.events,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static completeTrip(callback = defaultCallback) {
    const tripOptions = Radar.getTripOptions();
    Trips.updateTrip(tripOptions, TRIP_STATUS.COMPLETED).then(response => {
      // clear tripOptions
      Cookie.deleteCookie(Cookie.TRIP_OPTIONS);
      callback(null, {
        trip: response.trip,
        events: response.events,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static cancelTrip(callback = defaultCallback) {
    const tripOptions = Radar.getTripOptions();
    Trips.updateTrip(tripOptions, TRIP_STATUS.CANCELED).then(response => {
      // clear tripOptions
      Cookie.deleteCookie(Cookie.TRIP_OPTIONS);
      callback(null, {
        trip: response.trip,
        events: response.events,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static getTripOptions() {
    let tripOptions = Cookie.getCookie(Cookie.TRIP_OPTIONS);

    if (tripOptions) {
      tripOptions = JSON.parse(tripOptions);
    }

    return tripOptions;
  }

  static searchPlaces(searchOptions, callback = defaultCallback) {
    Search.searchPlaces(searchOptions).then(response => {
      callback(null, {
        places: response.places,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static searchGeofences(searchOptions, callback = defaultCallback) {
    Search.searchGeofences(searchOptions).then(response => {
      callback(null, {
        geofences: response.geofences,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static autocomplete(searchOptions, callback = defaultCallback) {
    Search.autocomplete(searchOptions).then(response => {
      callback(null, {
        addresses: response.addresses,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static geocode(geocodeOptions, callback = defaultCallback) {
    Geocoding.geocode(geocodeOptions).then(response => {
      callback(null, {
        addresses: response.addresses,
        staus: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static reverseGeocode(arg0, arg1 = defaultCallback) {
    let callback;
    let geocodeOptions;

    if (typeof arg0 === 'function') {
      callback = arg0;
    } else {
      geocodeOptions = arg0;
      callback = arg1;
    }

    Geocoding.reverseGeocode(geocodeOptions).then(response => {
      callback(null, {
        addresses: response.addresses,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static ipGeocode(arg0, arg1 = defaultCallback) {
    let callback;
    let geocodeOptions;

    if (typeof arg0 === 'function') {
      callback = arg0;
    } else if (typeof arg0 === 'object') {
      geocodeOptions = arg0;
      callback = arg1;
    }

    Geocoding.ipGeocode(geocodeOptions).then(response => {
      callback(null, {
        address: response.address,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static getDistance(routingOptions, callback = defaultCallback) {
    Routing.getDistanceToDestination(routingOptions).then(response => {
      callback(null, {
        routes: response.routes,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

  static getMatrix(routingOptions, callback = defaultCallback) {
    Routing.getMatrixDistances(routingOptions).then(response => {
      callback(null, {
        origins: response.origins,
        destinations: response.destinations,
        matrix: response.matrix,
        status: STATUS.SUCCESS
      }, response);
    }).catch(handleError(callback));
  }

}

export default Radar;
