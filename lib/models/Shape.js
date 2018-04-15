const Builder = require('./Builder');

class ShapeBuilder extends Builder {
    build() {
        this.setFinalized();
        try {
            this.defined("polyline");
        } catch(e) {
            throw e;
        }
        let s = new Shape();
        s.polyline = this['polyline'];
        return s;
    }
}

class Shape {}

module.exports = {Shape: Shape, ShapeBuilder: ShapeBuilder};