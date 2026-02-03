document.addEventListener("DOMContentLoaded", () => {

    const blogGrid = document.getElementById("blogGrid");
    const blogLoading = document.getElementById("blogLoading");
    const addBtn = document.getElementById("addTitleBtn");
    const form = document.getElementById("blogForm");
    const closeBtn = document.getElementById("closeFormBtn");

    if (!blogGrid) return; // safety guard

    // Toggle form
    addBtn?.addEventListener("click", () => {
        form.style.display = "block";
    });

    closeBtn?.addEventListener("click", () => {
        form.style.display = "none";
    });

    // Fetch posts
    fetch("/api/posts/")
        .then(res => res.json())
        .then(posts => {
            blogLoading.remove();

            if (!posts.length) {
                blogGrid.innerHTML = `<div class="empty-state">No posts yet</div>`;
                return;
            }

            posts.forEach(post => {
                blogGrid.insertAdjacentHTML("beforeend", `
                    <div class="blog-card">
                        <div class="blog-img-container">
                            <img src="${post.image || ''}" class="blog-img">
                        </div>
                        <div class="blog-content">
                            <div class="blog-title">${post.title}</div>
                            <div class="blog-desc">${post.excerpt || post.content.slice(0,120)}...</div>
                        </div>
                    </div>
                `);
            });
        })
        .catch(() => {
            blogGrid.innerHTML = `<div class="empty-state">Failed to load posts</div>`;
        });

});
