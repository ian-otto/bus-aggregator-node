class Builder {
    constructor() {
        this._finalized = false;
    }
    setFinalized() {this._finalized = true;}
    isFinalized() {return this._finalized;}

    setAndReturn(prop, value) {
        if(!this.isFinalized()) {
            this[prop] = value;
            return this;
        } else {
            throw new Error("Attempt to set property after builder is finalized.");
        }
    }

    defined(prop) {
        if(this[prop] !== undefined) {
            return this;
        }
        throw new Error("Property " + prop + " was undefined.");
    }

    build() {
        throw new Error("Builder #build not overridden");
    }
}

module.exports = Builder;