// consts
import STATUS from './status_codes';

class Navigator {
  static getCurrentPosition() {
    return new Promsie((resolve, reject) => {

      if (!navigator || !navigator.geolocation) {
        return reject(STATUS.ERROR_LOCATION);
      }

      navigator.geolocation.getCurrentPosition(
        // success callback
        (position) => {
          if (!position || !position.coords) {
            return reject(STATUS.ERROR_LOCATION);
          }

          const { latitude, longitude, accuracy } = position.coords;

          return resolve({ latitude, longitude, accuracy });
        },
        // error callback
        (err) => {
          if (err && err.code) {
            if (err.code === 1) {
              return reject(STATUS.ERROR_PERMISSIONS);
            }
          }
          return reject(STATUS.ERROR_LOCATION);
        }
      );
    });
  }
}

export default Navigator;
