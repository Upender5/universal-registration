class InMemoryStorage {
    constructor() {
      this.users = [];
    }
  
    save(data, callback) {
      this.users.push(data);
      callback(null);
    }
  
    getAllUsers() {
      return this.users;
    }
  }
  
  module.exports = InMemoryStorage;
  