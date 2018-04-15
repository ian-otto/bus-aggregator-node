const Builder = require('./Builder');

class RouteBuilder extends Builder {
    build() {
        this.setFinalized();
        try {
            this.defined("humanName").defined("routeNumber").defined("color")
                .defined("active").defined("shortName").defined("textColor")
                .defined("stopIdArray").defined("shapeId");
        } catch(e) {
            throw e;
        }
        let r = new Route();
        r.humanName = this['humanName'];
        r.shortName = this['shortName'];
        r.routeNumber = this['routeNumber'];
        r.color = this['color'];
        r.textColor = this['textColor'];
        r.active = this['active'];
        r.stopIdArray = this['stopIdArray'];
        r.shapeId = this['shapeId'];
        return r;
    }
}

class Route {
    setRouteShape(shape) {
        this.routeShape = shape;
    }
}

module.exports = {Route: Route, RouteBuilder: RouteBuilder};