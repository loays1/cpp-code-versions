#include <bits/stdc++.h>
#include <iostream>
#define ll long long
#define ld long double
using namespace std;
#define all(a) a.begin(), a.end()
#define rall(a) a.rbegin(), a.rend()
#include <ext/pb_ds/assoc_container.hpp>
#include <ext/pb_ds/tree_policy.hpp>
using namespace __gnu_pbds;
// #pragma GCC optimize("O3")
// #pragma GCC optimize("Ofast,unroll-loops")
typedef tree< int, null_type, less_equal<int>, rb_tree_tag, tree_order_statistics_node_update> OrderedSet;
// find_by_order : element at index i
// order_of_key  : how many elements < v
void erase(OrderedSet &t, int v)
{
  int rank = t.order_of_key(v);
  auto it = t.find_by_order(rank);
  t.erase(it);
}
bool isPrime(ll n) {
    if (n < 2)return 0;
    if(n==2)return 1;
    if(n%2==0)return 0;
    for (ll i = 3; i * i <= n; i+=2) 
      if (n % i == 0)
       return false;
    return true;
}
vector<ll> coordinateCompress(const vector<ll>& arr) {
    vector<ll> comp = arr;
    vector<ll> compressed(arr.size());
    sort(comp.begin(), comp.end());
    comp.erase(unique(comp.begin(), comp.end()), comp.end());
    for (ll i = 0; i < arr.size(); i++) 
    compressed[i] =lower_bound(comp.begin(), comp.end(), arr[i]) - comp.begin();
    return compressed;
}
vector<bool> sieve(ll n) { // prime num from 0 to n
    vector<bool> isPrime(n + 1, true);
    isPrime[0] = false;
    if (n >= 1)
    isPrime[1] = false;
    for (ll i = 2; i * i <= n; i++) {
     if (isPrime[i]){
      for (ll j = i * i; j <= n; j += i) 
         isPrime[j] = false;  
     }     
    }
    return isPrime;
}
vector<ll> sieveNumOfPrime(ll n) { 
   vector<ll> cnt(n + 1, 0);
    for (ll i = 2; i <= n; i++)
    {
        if (cnt[i] == 0)
        {
            for (ll j = i; j <= n; j += i)
            {
                cnt[j]++;
            }
        }
    }
    return cnt;
}
vector<ll> smallestPrimeFactor(ll n) {
 vector<ll> SPF(n + 1, 0); 
     for (int i = 2; i <= n; i++) { 
        if (SPF[i] == 0) {
             SPF[i] = i; 
             if (1LL * i * i <= n) {
                 for (ll j = i * i; j <= n; j += i) {
                     if (SPF[j] == 0)
                     SPF[j] = i; 
              }
           }
       } 
   }
   return SPF;
}
//  sort(arr.begin(), arr.end(), [](const pair<int,int>& a, const pair<int,int>& b) { // arrayName = arr
//     if (a.first != b.first)
//     return a.first > b.first;   // first Ascending
//     return a.second < b.second; // second Descending
// });
// ..........................................................
vector<pair<ll, int>> primeFactorization(ll n) {
    vector<pair<ll, int>> factors;
    for (ll i = 2; i * i <= n; i++) {
        int count = 0;
        while (n % i == 0) {
            count++;
            n /= i;
        }
        if (count > 0) 
            factors.push_back({i, count});
    }
    if (n > 1) 
        factors.push_back({n, 1});
    return factors;
}
void fun(string s){
    if(s.size()==3){
        cout << s <<'\n';
        return;
    }
   fun(s+"A");
   fun(s+"B");
   fun(s+"C");
}
const int N = 5e5 + 5;
const ll INF = 5e9 + 5;
//vector<ll>group[N];
//<bool>vis(N,false);
//vector<ll>leaf(N,0);
//bool vis[1005][1005]{};
//ll par[N]{};
pair <ll,ll> parent[1005][1005]{};
//vector<ll>ans(N,0);
//int arr[1005][1005]{};
bool can = false;
// vector<ll>ans(1001,0);
vector<string> grid;
//ll arr[1001]{};
int fun1(vector<ll> &arr , ll left , ll right , ll val){
   if(left>right)return -1;
   ll mid = left + (right-left)/2;
   if(arr[mid]==val)return mid+1;
   if(arr[mid]>val)return fun1(arr,left , mid-1,val);
   else return fun1(arr,mid+1,right,val);
}
/*
Pattern Matching
text = abacabaabac
pattern = aba
index:  0 1 2 3 4 5 6
s:      a b a c a b a
z:      0 0 1 0 3 0 1
*/
vector<ll> z_algo(string s) {
  vector<ll> z(s.size());
  for (ll i = 1, l = 0, r = 0; i < s.size(); i++) {
    if (i < r)
      z[i] = min(r - i, z[i - l]);
    while (i + z[i] < s.size() && s[z[i]] == s[z[i] + i])
      z[i]++;
    if (i + z[i] > r) {
      r = i + z[i];
      l = i;
    }
  }
  return z;
}


// get max odd len = res[2 * i]; aba -> i = b
// get max even len = res[2 * i + 1]; abba -> i = first b
/*
1-is the substring from l to r is Palindrome
man[l + r] >= r - l + 1
2-Longest Palindromic Substring
*/
vector <ll> manacher(const string &t) {
  string s = "%#";
  s.reserve(t.size() * 2 + 3);
  for (char c : t)
    s += c + "#"s;
  s += '$';
  // t = aabaacaabaa -> s = %#a#a#b#a#a#c#a#a#b#a#a#$
  vector<ll> res(s.size());
  for (ll i = 1, l = 1, r = 1; i < s.size(); i++) {
    res[i] = max(0LL, min(r - i, res[l + r - i]));
    while (s[i + res[i]] == s[i - res[i]])
      res[i]++;

    if (i + res[i] > r) {
      l = i - res[i];
      r = i + res[i];
    }
  }
  for (auto &i : res)
    i--;
  return vector<ll>(res.begin() + 2, res.end() - 2);
}
// check palindromic substring
// auto man = manacher(s);
// auto check = [&](int l, int r) {
//   return man[l + r] >= r - l + 1;
// };
const ll mod = 1e9 + 7;
ll sumD(ll n)
{
   if(n<9)return n;
   return n%10 +sumD(n/10);
}
//vector<ll>g[N];
void sol()
{



}
int main() {
    ios::sync_with_stdio(false);
    cin.tie(NULL);
    int t = 1;
    //freopen("inputmilk.in", "r", stdin);
    //freopen("output.txt", "w", stdout); 
    cin >> t;
    //cin.ignore();
    while (t--)
     sol();
}   