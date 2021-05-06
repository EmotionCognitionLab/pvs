function fragload(key_to_path) {
    const promises = Array.from(key_to_path).map(([key, path]) => 
        fetch(path).then(res => {
            if (!res.ok) {
                throw new Error(`fetch of "${path}" not ok!`);
            } else {
                return res.text()
            }
        }).then(text => [key, text])
    );
    return Promise.all(promises).then(pairs => new Map(pairs));
}
