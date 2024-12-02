export default class BaseUtilObject {
	constructor() {
		throw new Error(`${this.constructor.name} is non-instantiable`);
	}
}
