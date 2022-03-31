function get(url) {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.withCredentials = true
      req.open('GET', url);
      req.onload = () => req.status === 200 ? resolve(req.response) : reject(Error(req.statusText));
      req.onerror = (e) => reject(Error(`Network Error: ${e}`));
      req.send();
    });
}

function setLoading(state) {
    const initial = document.getElementById('initial');
    if (!initial) { return }

    if (state) {
        initial.innerHTML = '<td colspan="3" align="center">Loading...</td>';
    } else {
        initial.innerHTML = '<td colspan="3" align="center">Tidak ada data</td>';
    }
}

function setContent(data) {
    const tbody = document.getElementById('tbody')
    tbody.innerHTML = ''
    data.forEach((file, i) => {
        tbody.innerHTML += `
            <tr>
                <th>${i + 1}</th>
                <td>${file}</td>
                <td>
                    <button type="submit" class="btn btn-secondary btn-sm" onclick="window.open('/download/${file}')">Download</button>
                    <button class="btn btn-danger btn-sm delete" data-file="${file}">Hapus</button>
                </td>
            </tr>
        `
    });
    var deletes = document.getElementsByClassName("delete");
    for (let btn of deletes) {
        btn.addEventListener('click', askDelete)
    }
}

getData()
function getData () {
    setLoading(true)
    get('/template').then(res => {
        const data = JSON.parse(res)
        if (data && data.length) {
            setContent(data)
        }
    }).finally(() => {
        setLoading(false)
    })
}

const btnUpload = document.getElementById('upload')
btnUpload.addEventListener('click', uploadFile)
async function uploadFile() {
    const file = document.getElementById('inputFile')
    if (file.files.length !== 1) {
        window.alert('invalid input value')
        return
    }

    let formData = new FormData();           
    formData.append("template", file.files[0]);
    try {
        await fetch('/template', {
          method: "POST", 
          body: formData
        })
        file.value = ''
        var modalEL = document.getElementById('modal');
        var modal = bootstrap.Modal.getInstance(modalEL)
        modal.hide();
        getData();
    } catch (error) {
        window.alert('Error upload file')
    }
}

async function askDelete (e) {
    const ask = window.confirm('Are you sure?')
    if (ask) {
        const target = e.target
        const file = target.getAttribute('data-file')
        try {
            await fetch(`/template/${file}`, {
              method: "DELETE"
            })
            getData();
        } catch (error) {
            window.alert('Error delete file')
        }
    }
}