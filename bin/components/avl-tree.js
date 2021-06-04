class BST {

    #compare;
    #index;
    #root;
    #size;

    /**
     * Creates an instance of BST (Binary Search Tree).
     * 
     * @param {function} [comparator=null] A custom comparator function if inserts will be anything other than integers.
     * @param {string} [index=null] When saving arrays or objects in the tree, what property name or index number should be considered the key.
     * @memberof BST
     */
    constructor( comparator = null, index = null ) {
        this.#index = index;
        this.#root = null;
        this.#size = 0;
        if( comparator && typeof comparator == 'function' ) {
            this.#compare = comparator;
        } else {
            this.#compare = function(a, b) {
                if (a > b) { return 1; }
                if (a < b) { return -1; }
                return 0
            };
        }
    }

    /**
     * @alias insert
     * @memberof BST
     */
    add( key ) {
        this.insert(key);
    }

    /**
     * A new node for the BST.
     *
     * @param {*} key An integer or any other datatype to store at this node.
     * @param {object} [left=null] A BST node object that represenst the nodes left tree.
     * @param {object} [right=null] A BST node object that represenst the nodes right tree.
     * @return {object} A BST node object.
     * @memberof BST
     */
    createNode( key, left = null, right = null ) {
        return Object.seal( {
            key: key,
            left: left,
            right: right
        } );
    }

    /**
     * @alias search
     * @memberof BST
     */
    find( key, node ) {
        return this.search( key, node );
    }

    /**
     * A helper method that treats this BST as an array and mimics Array.forEach().
     *
     * @param {function} callback The function to send nodes back to as we traverse the tree.
     * @memberof BST
     */
    forEach( callback ) {
        this.traverseInOrder( callback, this.#root );
    }

    /**
     * Give public access to the BST's root node.
     *
     * @return {object} The BST root node. 
     * @memberof BST
     */
    getRoot() {
        return this.#root;
    }

    /**
     * @alias traverseInOrder
     * @memberof BST
     */
    inOrder( callback, node ) {
        this.traverseInOrder( callback, node );
    }

    /**
     * Insert a new item into this BST.
     *
     * @param {*} key An integer or any other data to add to this BST.
     * @memberof BST
     */
    insert( key ) {
        this.#root = this.#insertNode( this.#root, key );
        this.#size++;
    }

    /**
     * Checks if the BST is balanced; unless you managed balancing yourself or extended BST
     * this will most likely return false.
     *
     * @param {object} [node=null] The node to start from when checking for balance; defaults to this.#root.
     * @memberof BST
     */
    isBalanced( node = this.#root ) {
        if ( node == null ) {
            return true;
        }
        const lh = this.maxHeight( node.left );
        const rh = this.maxHeight( root.right );
        if ( Math.abs( lh - rh ) <= 1 ){
            return true;
        }
        return false;
    }

    /**
     * Checks to see if a key is present in the BST.
     *
     * @param {*} key An integer or any other datatype to search for.
     * @param {object} [node=null] The node to start the search from; defaults to this.#root.
     * @return {boolean} True if the key exists in the BST, false if not.
     * @memberof BST
     */
    isPresent( key, node = this.#root ) {
        if ( this.search( key, node ) ) {
            return true;
        }
        return false;
    }

    /**
     * Helper function to determine the max height from a given node.
     *
     * @param {object} node The node to start the search from.
     * @return {int} The calculated height.
     * @memberof BST
     */
    maxHeight( node ) {
        if ( node == null ) {
            return -1;
        }
        let left = this.maxHeight( node.left );
        let right = this.maxHeight( node.right );
        if ( left > right ) {
            return left + 1;
        } else {
            return right + 1;
        }
    }

    /**
     * Helper function to get the max node (node with max height) from a given node.
     *
     * @param {object} node The node to start the search from; defaults to this.#root.
     * @return {object} The node with the highest value from the starting node.
     * @memberof BST
     */
    maxNode( node = this.#root ) {
        while( node.right != null ) {
            node = node.right;
        }
        return node;
    }

    /**
     * Helper function to get the max node value (node with max height) from a given node.
     *
     * @param {object} node The node to start the search from; defaults to this.#root.
     * @return {*} The node value (key) of the node with the highest value from the starting node.
     * @memberof BST
     */
    maxValue( node = this.#root ) {
        node = this.maxNode( node );
        if ( node != null ) {
            return node.key;
        }
        return null;
    }

    /**
     * Helper function to determine the min height from a given node.
     *
     * @param {object} node The node to start the search from.
     * @return {int} The calculated height.
     * @memberof BST
     */
    minHeight( node ) {
        if ( node == null ) {
            return -1;
        }
        let left = this.minHeight( node.left );
        let right = this.minHeight( node.right );
        if ( left < right ) {
            return left + 1;
        } else {
            return right + 1;
        }
    }

    /**
     * Helper function to get the min node (node with min height) from a given node.
     *
     * @param {object} node The node to start the search from; defaults to this.#root.
     * @return {object} The node with the lowest value from the starting node.
     * @memberof BST
     */
    minNode( node = this.#root ) {
        while( node.left != null ) {
            node = node.left;
        }
        return node;
    }

    /**
     * Helper function to get the min node value (node with min height) from a given node.
     *
     * @param {object} node The node to start the search from.
     * @return {*} The node value (key) of the node with the lowest value from the starting node.
     * @memberof BST
     */
    minValue( node = this.#root ) {
        node = this.minNode( node );
        if ( node != null ) {
            return node.key;
        }
        return null;
    }

    /**
     * @alias traversePostOrder
     * @memberof BST
     */
    postOrder( callback, node ) {
        this.traversePostOrder( callback, node );
    }

    /**
     * @alias traversePreOrder
     * @memberof BST
     */
    preOrder( callback, node ) {
        this.traversePreOrder( callback, node );
    }

    /**
     * Prints a simple horizontal representation of the tree meant for debugging and simple 
     * visualizations. The code for this was converted to JavaScript from this 
     * {@link https://stackoverflow.com/a/19484210/3193156|Java code}.
     *
     * @param {object} [node=this.#root] The node to start printing from; defaults to this.#root.
     * @memberof BST
     * @see https://stackoverflow.com/a/19484210/3193156
     */
    print( node = this.#root ) {
        if ( node == null ) {
            console.log('<empty>');
            return;
        }
        /**
         * We need to build up the output, use an object to store it since
         * they can be passed by reference.
         */
        let output = { out: "" };
        if ( node.right ) {
            this.#printTree( node.right, true, "", output );
        }
        this.#printNodeValue( node, output );
        if ( node.left ) {
            this.#printTree( node.left, false, "", output );
        }
        console.log( output.out );
    }

    /**
     * Removes an item from the BST if it exists.
     *
     * @param {*} key An integer or any other data to remove from this tree.
     * @memberof BST
     */
    remove( key ) {
        this.#root = this.#removeNode( this.#root, key );
    }

    /**
     * @alias getRoot
     * @memberof BST
     */
    root() {
        return this.getRoot();
    }

    /**
     * Search the current tree and attempt to locate the requested key.
     *
     * @param {*} key An integer or any other datatype to search for.
     * @param {object} current The node to start the search at; defaults to this.#root.
     * @return {object} The node matching the key or null.
     * @memberof BST
     */
    search( key, current = this.#root ) {
        while( current ) {
            switch( this.#compare( key, current.key ) ) {
                case -1:
                    current = current.left;
                    break;
                case 0:
                    return current;
                case 1:
                    current = current.right;
                    break;
            }
        }
        return current;
    }

    /**
     * Getter to get the trees current size.
     *
     * @return {int} The trees current size; length.
     * @memberof BST
     */
    size() {
        return this.#size;
    }

    /**
     * Traverse a tree in-order.
     *
     * @param {function} callback The function to send nodes back to as we traverse the tree.
     * @param {object} node The node to start the traversal at.
     * @memberof BST
     */
    traverseInOrder( callback, node ) {
        if ( node != null ) {
            this.traverseInOrder( callback, node.left );
            callback( node.key );
            this.traverseInOrder( callback, node.right );
        }
    }

    /**
     * Traverse the tree pre-order.
     * 
     * @param {function} callback The function to send nodes back to as we traverse the tree. 
     * @param {object} node The node to start the traversal at.
     * @memberof BST
     */
    traversePreOrder( callback, node ) {
        if ( node != null ) {
            callback( node.key );
            this.traversePreOrder( callback, node.left );
            this.traversePreOrder( callback, node.right );
        }
    }
    
    /**
     * Traverse the tree in post-order.
     *
     * @param {function} callback The function to send nodes back to as we traverse the tree.
     * @param {object} node The node to start the traversal at.
     * @memberof BST
     */
    traversePostOrder( callback, node ) {
        if ( node != null ) {
            this.traversePostOrder( callback, node.left );
            this.traversePostOrder( callback, node.right );
            callback( node.key );
        }
    }

    /**
     * Traverse the tree in reverse-order.
     *
     * @param {function} callback The function to send nodes back to as we traverse the tree.
     * @param {object} node The node to start the traversal at.
     * @memberof BST
     */
    traverseReversedOrder( callback, node ) {
        if ( node != null ) {
            this.traverseReversedOrder( callback, node.right );
            callback( node.key );
            this.traverseReversedOrder( callback, node.left );
        }
    }

    /**
     * Recursively add a new node to this tree. 
     *
     * @param {object} node The current node to operate on.
     * @param {*} key An integer or any other datatype to add to the tree.
     * @return {object|null} The result of the recursion: a node object or null.
     * @private
     * @memberof BST
     */
    #insertNode( node, key ) {
        if( node == null ) {
            node = this.createNode( key );
            return node;
        }

        switch( this.#compare( key, node.key ) ) {
            case -1: // Go left.
                node.left = this.#insertNode( node.left, key );
                break;
            case 0: // Cannot add key of equal value!
                this.#size--;
                break;
            case 1: // Go right.
                node.right = this.#insertNode( node.right, key );
                break;
        }

        return node;
    }

    /**
     * Helper function of print() that prints a nodes key/ value to the console.
     *
     * @param {object} node The node object to print out.
     * @param {object} out The output object to add the nodes "tostring" to.
     * @memberof BST
     */
    #printNodeValue( node, out ) {
        if ( node != null ) {
            console.log( this.#index );
            if ( this.#index != null ) {
                out.out += node.key[ this.#index ] + '\n';
            } else {
                out.out += node.key + '\n';
            }
        }
    }

    /**
     * Helper function of print() transverses the tree and prints it visually to the console.
     *
     * @param {object} node The current node to operate on.
     * @param {boolean} isRight Is this node from the right branch of a tree.
     * @param {string} indent The current indent string.
     * @param {object} out The output object to add the visual tree structure to.
     * @memberof BST
     */
    #printTree( node, isRight, indent, out ) {
        if( node.right != null ) {
            this.#printTree( node.right, true, indent + ( isRight ? "        " : " |      " ), out );
        }
        out.out += indent;
        if( isRight ) {
            out.out += ' /';
        } else {
            out.out += ' \\';
        }
        out.out +='----- ';
        this.#printNodeValue( node, out );
        if( node.left != null ) {
            this.#printTree( node.left, false, indent + ( isRight ? " |      " : "        " ), out );
        }
    }

    /**
     * Recursively look for and remove a node from this tree. 
     *
     * @param {object} node The current node to operate on.
     * @param {*} key An integer or any other datatype to find and remove.
     * @return {object|null} The result of the recursion: a node object or null.
     * @private
     * @memberof BST
     */
    #removeNode( node, key ) {
        if ( node == null ) {
            return node;
        }

        switch( this.#compare( key, node.key ) ) {
            case -1: // Go left.
                node.left = this.#removeNode( node.left, key );
                break;
            case 0: // Target node.
                // No left children.
                if ( node.left == null ) {
                    this.#size--;
                    return node.right;
                }
                // No right children.
                if ( node.right == null ) {
                    this.#size--;
                    return node.left;
                }
                // Both children. Get the inorder successor (smallest in the right subtree).
                node.key = this.minValue( node.right );
                // Delete the inorder successor.
                node.right = this.#removeNode( node.right, node.key );
                break;
            case 1: // Go right.
                node.right = this.#removeNode( node.right, key );
                break;
        }

        return node;
    }
}

class AVLTree extends BST {

    #compare;
    #index;
    #root;
    #size;
    
    /**
     * Creates an instance of BST (Binary Search Tree).
     * 
     * @param {function} [comparator=null] A custom comparator function if inserts will be anything other than integers.
     * @param {string} [index=null] When saving arrays or objects in the tree, what property name or index number should be considered the key.
     * @memberof AVLTree
     */
    constructor( comparator = null, index = null ) {
        // We can reuse a lot of BST methods so make sure BST uses the same comparator.
        let func = null;
        if( comparator && typeof comparator == 'function' ) {
            func = comparator;
        } else {
            func = function(a, b) {
                if (a > b) { return 1; }
                if (a < b) { return -1; }
                return 0
            };
        }
        super( func, index );
        // Setup child class properties.
        this.#compare = func;
        this.#index = index;
        this.#root = null;
        this.#size = 0;
    }

    /**
     * @alias insert
     * @memberof AVLTree
     */
    add( key ) {
        this.insert(key);
    }

    /**
     * A new node for the AVLTree.
     *
     * @param {*} key An integer or any other datatype to store at this node.
     * @param {object} [left=null] A BST node object that represenst the nodes left tree.
     * @param {object} [right=null] A BST node object that represenst the nodes right tree.
     * @return {object} An AVLTree node object.
     * @memberof AVLTree
     */
    createNode( key, left = null, right = null ) {
        return Object.seal( {
            key: key,
            height: 0,
            left: left,
            right: right
        } );
    }

    /**
     * @alias search
     * @memberof AVLTree
     */
    find( key, node = this.#root ) {
        return super.search( key, node );
    }

    /**
     * A helper method that treats this AVLTree as an array and mimics Array.forEach().
     *
     * @param {function} callback The function to send nodes back to as we traverse the tree.
     * @memberof AVLTree
     */
    forEach( callback ) {
        super.traverseInOrder( callback, this.#root );
    }

    /**
     * Helper function to determine the balance of the provided tree/ sub-tree.
     *
     * @param {object} node The node to check from.
     * @return {int} The balance status of this tree or sub-tree.
     * @memberof AVLTree
     */
    getBalance( node ) {
        if ( node == null ) {
            return 0;
        }
        return this.height( node.left ) - this.height( node.right );
    }

    /**
     * Give public access to the AVLTree's root node.
     *
     * @return {object} The AVLTree root node. 
     * @memberof AVLTree
     */
    getRoot() {
        return this.#root;
    }

    /**
     * Helper function to grab a nodes height.
     *
     * @param {object} node The node to get the height from.
     * @return {int} The height of this node. 
     * @memberof AVLTree
     */
    height( node ) {
        if ( node == null ) {
            return 0;
        }
        return node.height;
    }

    /**
     * @alias traverseInOrder
     * @memberof AVLTree
     */
    inOrder( callback, node = this.#root ) {
        super.traverseInOrder( callback, node );
    }

    /**
     * Insert a new item into this AVLTree.
     *
     * @param {*} key An integer or any other data to add to this AVLTree.
     * @memberof AVLTree
     */
    insert( key ) {
        this.#root = this.#insertNode( this.#root, key ); 
        this.#size++;
    }

    /**
     * Checks if the AVLTree is balanced; unless you managed balancing yourself or extended
     * AVLTree this will most likely return false.
     *
     * @param {object} [node=null] The node to start from when checking for balance; defaults to this.#root.
     * @memberof AVLTree
     */
    isBalanced() {
        return super.isBalanced( this.#root );
    }

    /**
     * Checks to see if a key is present in the AVLTree.
     *
     * @param {*} key An integer or any other datatype to search for.
     * @param {object} [node=null] The node to start the search from; defaults to this.#root;
     * @return {boolean} True if the key exists in the AVLTree, false if not.
     * @memberof AVLTree
     */
    isPresent( key, node = this.#root ) {
        return super.isPresent( key, node );
    }

    /**
     * @alias traverseLevelOrder
     * @memberof AVLTree
     */
    levelOrder( callback, node = this.#root ) {
        this.traverseLevelOrder( callback, node );
    }

    /**
     * Helper function to return the bigger number between two numbers.
     *
     * @param {int} int1 The first number to check against the second.
     * @param {int} int2 The second number to check against the first.
     * @return {int} The bigger number.
     * @memberof AVLTree
     */
    max( int1, int2 ) {
        if( int1 > int2 ) {
            return int1;
        }
        return int2;
    }

    /**
     * Helper function to determine the max height from a given node.
     *
     * @param {object} node The node to start the search from.
     * @return {int} The calculated height.
     * @memberof AVLTree
     */
    maxHeight( node = this.#root ) {
        return super.maxHeight( node );
    }

    /**
     * Helper function to get the max node (node with max height) from a given node.
     *
     * @param {object} node The node to start the search from; defaults to this.#root.
     * @return {object} The node with the highest value from the starting node.
     * @memberof AVLTree
     */
    maxNode( node = this.#root ) {
        return super.maxNode( node );
    }

    /**
     * Helper function to get the max node value (node with max height) from a given node.
     *
     * @param {object} node The node to start the search from; defaults to this.#root.
     * @return {*} The node value (key) of the node with the highest value from the starting node.
     * @memberof AVLTree
     */
    maxValue( node = this.#root ) {
        return super.maxValue( node );
    }

    /**
     * Helper function to determine the min height from a given node.
     *
     * @param {object} node The node to start the search from.
     * @return {int} The calculated height.
     * @memberof AVLTree
     */
    minHeight( node = this.#root ) {
        return super.minHeight( node );
    }

    /**
     * Helper function to get the min node (node with min height) from a given node.
     *
     * @param {object} node The node to start the search from; defaults to this.#root.
     * @return {object} The node with the lowest value from the starting node.
     * @memberof AVLTree
     */
    minNode( node = this.#root ) {
        return super.minNode( node );
    }

    /**
     * Helper function to get the min node value (node with min height) from a given node.
     *
     * @param {object} node The node to start the search from.
     * @return {*} The node value (key) of the node with the lowest value from the starting node.
     * @memberof AVLTree
     */
    minValue( node = this.#root ) {
       return super.minValue( node );
    }

    /**
     * @alias traversePostOrder
     * @memberof AVLTree
     */
    postOrder( callback, node = this.#root ) {
        super.traversePostOrder( callback, node );
    }

    /**
     * @alias traversePreOrder
     * @memberof AVLTree
     */
    preOrder( callback, node = this.#root ) {
        super.traversePreOrder( callback, node );
    }

    /**
     * Prints a simple horizontal representation of the tree meant for debugging and simple 
     * visualizations. The code for this was converted to JavaScript from this 
     * {@link https://stackoverflow.com/a/19484210/3193156|Java code}.
     *
     * @param {object} [node=this.#root] The node to start printing from; defaults to this.#root.
     * @memberof AVLTree
     * @see https://stackoverflow.com/a/19484210/3193156
     */
    print( node = this.#root ) {
        super.print( node );
    }

    /**
     * Removes an item from the AVLTree if it exists.
     *
     * @param {*} key An integer or any other data to remove from this tree.
     * @memberof AVLTree
     */
    remove( key ) {
        this.#root = this.#removeNode( this.#root, key );
    }

    /**
     * @alias getRoot
     * @memberof AVLTree
     */
    root() {
        return this.getRoot();
    }

    /**
     * Search the current tree and attempt to locate the requested key.
     *
     * @param {*} key An integer or any other datatype to search for.
     * @param {object} current The node to start the search at; defaults to this.#root.
     * @return {object|null} The node matching the key or null.
     * @memberof AVLTree
     */
    search( key, current = this.#root ) {
        return super.search( key, current );
    }

    /**
     * Getter to get the trees current size.
     *
     * @return {int} The trees current size; length.
     * @memberof AVLTree
     */
    size() {
        return this.#size;
    }

    /**
     * Traverse a tree in level-order.
     *
     * @param {function} callback The function to send nodes back to as we traverse the tree.
     * @param {object} node The node to start the traversal at.
     * @memberof BST
     */
    traverseLevelOrder( callback, node ) {
        if ( node != null ) {
            let level = 1;
            while( this.#checkLevel( callback, node, level ) ) {
                level++;
            }
        }
    }

    /**
     * Helper function for traverseLevelOrder() that traverses the list in level order.
     * 
     * @param {*} callback
     * @param {*} node
     * @param {*} level
     * @return {*} 
     * @memberof AVLTree
     */
    #checkLevel( callback, node, level ) {
        if ( node == null ) {
            return false;
        }
        if ( level == 1 ) {
            callback( node.key );
            return true;
        }
        let l = this.#checkLevel( callback, node.left, level - 1 );
        let r = this.#checkLevel( callback, node.right, level - 1 );
        return l || r;
    }

    /**
     * Recursively add a new node to this tree. 
     *
     * @param {object} node The current node to operate on.
     * @param {*} key An integer or any other datatype to add to the tree.
     * @return {object|null} The result of the recursion: a node object or null.
     * @private
     * @memberof AVLTree
     */
     #insertNode( node, key ) {
        // 1. Perform the normal BST rotation.
        if( node == null ) {
            node = this.createNode( key );
            return node;
        }

        switch( this.#compare( key, node.key ) ) {
            case -1: // Go left.
                node.left = this.#insertNode( node.left, key );
                break;
            case 0: // Cannot add key of equal value!
                this.#size--;
                return node;
            case 1: // Go right.
                node.right = this.#insertNode( node.right, key );
                break;
        }

        // 2. Update node height.
        node.height = 1 + this.max( this.height( node.left ), this.height( node.right ) );

        // 3. Get balance factor.
        const balance = this.getBalance( node );

        // 4. Balance as needed based on 1 of 4 cases:

        // Left Left.
        if ( balance > 1 && node.left != null ) {
            if ( this.#compare( key, node.left.key ) === -1 ) {
                return this.#rotateRight(node);
            }
        }

        // Right Right.
        if ( balance < -1 && node.right != null ) {
            if ( this.#compare( key, node.right.key ) === 1 ) {
                return this.#rotateLeft(node);
            }
        }

        // Left Right.
        if ( balance > 1 && node.left != null ) {
            if ( this.#compare( key, node.left.key ) === 1 ) {
                node.left = this.#rotateLeft(node.left);
                return this.#rotateRight(node);
            }
        }

        // Right Left.
        if ( balance < -1 && node.right != null ) {
            if ( this.#compare( key, node.right.key ) === -1 ) {
                node.right = this.#rotateRight(node.right);
                return this.#rotateLeft(node);
            }
        }
        
        // 5. Return if we haven't already.
        return node;
    }

    /**
     * Recursively look for and remove a node from this tree, then rebalance as needed.
     *
     * @param {object} node The current node to operate on.
     * @param {*} key An integer or any other datatype to find and remove.
     * @return {object|null} The result of the recursion: a node object or null.
     * @private
     * @memberof AVLTree
     */
    #removeNode( node, key ) {
        // 1. Perform normal deletion.
        if ( node == null ) {
            return node;
        }

        switch( this.#compare( key, node.key ) ) {
            case -1: // Go left.
                node.left = this.#removeNode( node.left, key );
                break;
            case 0: // Target node.
                // No left children.
                if ( node.left == null ) {
                    this.#size--;
                    return node.right;
                }
                // No right children.
                if ( node.right == null ) {
                    this.#size--;
                    return node.left;
                }
                // Both children. Get the inorder successor (smallest in the right subtree).
                node.key = this.minValue( node.right );
                // Delete the inorder successor.
                node.right = this.#removeNode( node.right, node.key );
                break;
            case 1: // Go right.
                node.right = this.#removeNode( node.right, key );
                break;
        }

        // 1.5. If the tree only has one node return now.
        if ( this.#root == null ){
            return node;
        }
        
        // 2. Update height of current node.
        node.height = this.max( this.height( node.left ), this.height( node.right) ) + 1;

        // 3. Check if node has become unbalanced.
        const balance = this.getBalance( node );

        // 4. Balance as needed based on 1 of 4 cases:

        // Left Left.
        if ( balance > 1 && node.left != null ) {
            if ( this.getBalance( node.left ) >= 0 ) {
                return this.#rotateRight(node);
            }
        }

        // Right Right.
        if ( balance < -1 && node.right != null ) {
            if ( this.getBalance( node.right ) <= 0 ) {
                return this.#rotateLeft(node);
            }
        }

        // Left Right.
        if ( balance > 1 && node.left != null ) {
            if ( this.getBalance( node.left ) < 0 ) {
                node.left = this.#rotateLeft(node.left);
                return this.#rotateRight(node);
            }
        }

        // Right Left.
        if ( balance < -1 && node.right != null ) {
            if ( this.getBalance( node.right ) > 0 ) {
                node.right = this.#rotateRight(node.right);
                return this.#rotateLeft(node);
            }
        }

        // 5. Return if we haven't already.
        return node;
    }

    /**
     * A helper function to rebalance a tree by rotating a portion left.
     *
     * @param {object} node The node that represents the current parent of the tree/ sub-tree to rotate.
     * @return {object} The new parent node with its children rotated accordingly.
     * @memberof AVLTree
     */
    #rotateLeft( node ) {
        const r = node.right;
        const l = r.left;
        // Perform rotation.
        r.left     = node;
        node.right = l;
        // Update heights.
        node.height = this.max( this.height( node.left ), this.height( node.right ) ) + 1;
        r.height    = this.max( this.height( r.left ), this.height( r.right ) ) + 1;
        // Return new root.
        return r;
    }

    /**
     * A helper function to rebalance a tree by rotating a portion right.
     *
     * @param {object} node The node that represents the current parent of the tree/ sub-tree to rotate.
     * @return {object} The new parent node with its children rotated accordingly.
     * @memberof AVLTree
     */
    #rotateRight( node ) {
        const l  = node.left;
        const r  = l.right;
        // Perform rotation.
        l.right   = node;
        node.left = r;
        // Update heights.
        node.height = this.max( this.height( node.left ), this.height( node.right ) ) + 1;
        l.height    = this.max( this.height( l.left ), this.height( l.right ) ) + 1;
        // Return new root.
        return l;
    }
}

module.exports = AVLTree;