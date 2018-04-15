const Builder = require('./Builder');

class StopBuilder extends Builder {
    build() {
        this.setFinalized();
        try {
            this.defined("stopNumber").defined("stopName").defined("lat")
                .defined("lng");
        } catch(e) {
            throw e;
        }
        let s = new Stop();
        s.stopNumber = this['stopNumber'];
        s.stopName = this['stopName'];
        s.latlng = [this['lat'], this['lng']];
        return s;
    }
}
class Stop {}

module.exports = {Stop: Stop, StopBuilder: StopBuilder};