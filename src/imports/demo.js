// Simulating an async operation that returns a promise
function someAsyncOperation(success = true) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (success) {
                resolve('Operation was successful!');
            } else {
                reject('Operation failed!');
            }
        }, 1000);
    });
}

// An async function that uses the above async operation
async function asyncFunction(shouldSucceed) {
    try {
        const result = await someAsyncOperation(shouldSucceed);
        return result;  // Resolves the promise with `result`
    } catch (error) {
        throw error;  // Rejects the promise with `error`
    }
}

// Example usage with a successful operation
asyncFunction(true)
    .then((result) => {
        console.log('Resolved with:', result);
    })
    .catch((error) => {
        console.error('Rejected with:', error);
    });

// Example usage with a failed operation
asyncFunction(false)
    .then((result) => {
        console.log('Resolved with:', result);
    })
    .catch((error) => {
        console.error('Rejected with:', error);
    });
