const Builder = require('./Builder');

class ETAInfoBuilder extends Builder {
    build() {
        this.setFinalized();
        try {
            this.defined("etaSeconds").defined('vehicleId').defined('linkName').defined('routeId');
        } catch(e) {
            throw e;
        }
        let s = new ETAInfo();
        s.etaSeconds = this['etaSeconds'];
        s.vehicleId = this['vehicleId'];
        s.routeId = this['routeId'];
        s.linkName = this.linkName;
        return s;
    }
}

class ETAInfo {}

module.exports = {ETAInfoBuilder: ETAInfoBuilder, ETAInfo: ETAInfo};